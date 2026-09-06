import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calculateMissionPrice,
  clampPercentage,
  round2,
  type PriceBreakdown,
  type PricingRule,
} from "@/lib/pricing-core";
import type { MissionCategory, MissionPriority } from "@/lib/towia";
import { markPaid } from "@/lib/payments.server";

type Ctx = { supabase: any; userId: string };

function toRuleRow(row: any): PricingRule {
  return {
    service_type: row.service_type,
    name: row.name ?? "Tarif professionnel",
    base_price: Number(row.base_price),
    price_per_km: Number(row.price_per_km),
    minimum_price: Number(row.minimum_price),
    night_surcharge: Number(row.night_surcharge),
    weekend_surcharge: Number(row.weekend_surcharge),
    emergency_surcharge: Number(row.emergency_surcharge),
  };
}

/** Recalcule le prix côté serveur : jamais de montant venant du navigateur. */
async function serverPrice(
  ctx: Ctx,
  mission: {
    category: MissionCategory;
    priority: MissionPriority;
    distance_km: number | null;
    operator_id: string | null;
    company_id: string | null;
  },
): Promise<PriceBreakdown | null> {
  const { data: setting } = await ctx.supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "platform_fee_percentage")
    .maybeSingle();
  const feePct = clampPercentage(Number(setting?.value ?? 10));

  let rule: PricingRule | null = null;
  let source: "operator" | "platform" = "platform";

  if (mission.operator_id || mission.company_id) {
    let q = ctx.supabase
      .from("operator_pricing")
      .select("*")
      .eq("service_type", mission.category)
      .eq("active", true);
    q = mission.operator_id
      ? q.eq("operator_id", mission.operator_id)
      : q.eq("company_id", mission.company_id);
    const { data } = await q.limit(1).maybeSingle();
    if (data) {
      rule = toRuleRow(data);
      source = "operator";
    }
  }

  if (!rule) {
    const { data } = await ctx.supabase
      .from("pricing_rules")
      .select("*")
      .eq("service_type", mission.category)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    rule = toRuleRow(data);
  }

  return calculateMissionPrice({
    serviceType: mission.category,
    priority: mission.priority,
    distanceKm: mission.distance_km,
    rule,
    source,
    platformFeePercentage: feePct,
  });
}

function stripeKey(): string | null {
  const key = process.env["STRIPE_SECRET_KEY"];
  return key && key.trim().length > 0 ? key.trim() : null;
}

async function stripeRequest(key: string, path: string, body: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? "Erreur Stripe");
  return json;
}

/** Estimation serveur (source de vérité) pour une mission du client connecté. */
export const getMissionQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { missionId: string }) => data)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: mission, error } = await ctx.supabase
      .from("missions")
      .select("id, client_id, category, priority, distance_km, operator_id, company_id, amount")
      .eq("id", data.missionId)
      .maybeSingle();
    if (error || !mission) throw new Error("Mission introuvable");
    if (mission.client_id !== ctx.userId) throw new Error("Accès refusé");

    const breakdown = await serverPrice(ctx, mission as any);
    return { breakdown, testMode: stripeKey() === null };
  });

/**
 * Crée (ou récupère) le paiement d'une mission.
 * - Stripe configuré → session Checkout, statut PROCESSING.
 * - Sinon → MODE TEST clairement identifié, aucun paiement réel.
 */
export const createMissionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { missionId: string; returnUrl?: string }) => data)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: mission } = await ctx.supabase
      .from("missions")
      .select("id, client_id, category, priority, distance_km, operator_id, company_id")
      .eq("id", data.missionId)
      .maybeSingle();
    if (!mission) throw new Error("Mission introuvable");
    if (mission.client_id !== ctx.userId) throw new Error("Accès refusé");

    const breakdown = await serverPrice(ctx, mission as any);
    if (!breakdown) throw new Error("Aucun tarif actif pour ce service");
    if (breakdown.total <= 0) throw new Error("Montant invalide");

    const key = stripeKey();
    const isTest = key === null;

    const { data: existing } = await ctx.supabase
      .from("payments")
      .select("*")
      .eq("mission_id", mission.id)
      .maybeSingle();

    if (existing?.status === "PAID") {
      return { mode: "paid" as const, paymentId: existing.id, breakdown };
    }

    const payload = {
      mission_id: mission.id,
      client_id: ctx.userId,
      operator_id: mission.operator_id,
      company_id: mission.company_id,
      amount: breakdown.total,
      currency: breakdown.currency,
      commission_rate: round2(breakdown.platform_fee_percentage / 100),
      platform_fee: breakdown.platform_fee,
      professional_amount: breakdown.operator_amount,
      status: "PENDING" as const,
      is_test: isTest,
      breakdown: breakdown as unknown as Record<string, unknown>,
      failure_reason: null,
    };

    // Écritures financières : uniquement côté serveur de confiance,
    // jamais avec la session du client (le client ne peut pas modifier les montants).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let paymentId = existing?.id as string | undefined;
    if (paymentId) {
      await supabaseAdmin.from("payments").update(payload as any).eq("id", paymentId);
    } else {
      const { data: created, error: insertError } = await supabaseAdmin
        .from("payments")
        .insert(payload as any)
        .select("id")
        .single();
      if (insertError || !created) throw new Error(insertError?.message ?? "Paiement impossible");
      paymentId = created.id;
    }

    await supabaseAdmin
      .from("missions")
      .update({
        estimated_amount: breakdown.total,
        price_breakdown: breakdown as any,
        payment_status: "pending",
      })
      .eq("id", mission.id);


    if (isTest) {
      return { mode: "test" as const, paymentId: paymentId!, breakdown };
    }

    const origin = data.returnUrl ?? "";
    const session = await stripeRequest(key!, "checkout/sessions", {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": breakdown.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(Math.round(breakdown.total * 100)),
      "line_items[0][price_data][product_data][name]": `TowIA — ${breakdown.rule_name}`,
      "metadata[mission_id]": mission.id,
      "metadata[payment_id]": paymentId!,
      success_url: `${origin}/client/mission/${mission.id}?paiement=succes`,
      cancel_url: `${origin}/client/paiement/${mission.id}?paiement=annule`,
    });

    await supabaseAdmin
      .from("payments")
      .update({
        status: "PROCESSING",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ?? null,
      })
      .eq("id", paymentId!);

    return { mode: "stripe" as const, paymentId: paymentId!, url: session.url as string, breakdown };
  });

/**
 * MODE TEST uniquement : marque le paiement comme payé en test.
 * Refuse de s'exécuter dès que Stripe est configuré.
 */
export const confirmTestPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { paymentId: string; outcome: "paid" | "failed" }) => data)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    if (stripeKey() !== null) {
      throw new Error("Stripe est configuré : le mode test est désactivé.");
    }
    const { data: payment } = await ctx.supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) throw new Error("Paiement introuvable");
    if (payment.client_id !== ctx.userId) throw new Error("Accès refusé");
    if (payment.status === "PAID") return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.outcome === "failed") {
      await supabaseAdmin
        .from("payments")
        .update({ status: "FAILED", failure_reason: "Échec simulé (mode test)" })
        .eq("id", payment.id);
      await supabaseAdmin
        .from("missions")
        .update({ payment_status: "failed" })
        .eq("id", payment.mission_id);
      return { ok: false };
    }

    await markPaid(supabaseAdmin, payment);
    return { ok: true };
  });

/** Remboursement administrateur. */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { paymentId: string; amount: number; reason: string }) => data)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès refusé");

    const { data: payment } = await ctx.supabase
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) throw new Error("Paiement introuvable");
    if (payment.status !== "PAID") throw new Error("Seul un paiement encaissé peut être remboursé");

    const amount = Math.min(Number(payment.amount ?? 0), Math.max(0, round2(data.amount)));
    if (amount <= 0) throw new Error("Montant de remboursement invalide");

    const key = stripeKey();
    if (key && payment.stripe_payment_intent_id) {
      await stripeRequest(key, "refunds", {
        payment_intent: payment.stripe_payment_intent_id,
        amount: String(Math.round(amount * 100)),
      });
    }

    const { supabaseAdmin: adminClient } = await import("@/integrations/supabase/client.server");
    await adminClient
      .from("payments")
      .update({ status: "REFUNDED", refunded_at: new Date().toISOString() })
      .eq("id", payment.id);
    await adminClient
      .from("missions")
      .update({ payment_status: "refunded" })
      .eq("id", payment.mission_id);
    await ctx.supabase.from("refunds").insert({
      payment_id: payment.id,
      mission_id: payment.mission_id,
      amount,
      reason: data.reason || null,
      administrator_id: ctx.userId,
    });
    await ctx.supabase.from("activity_logs").insert({
      user_id: ctx.userId,
      action: "payment_refunded",
      entity: "payments",
      entity_id: payment.id,
      metadata: { amount, reason: data.reason },
    });

    return { ok: true, amount };
  });
