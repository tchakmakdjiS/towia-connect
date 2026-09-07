import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PriceBreakdown } from "@/lib/pricing-core";

type Ctx = { supabase: any; userId: string };

export type MissionQuote = {
  id: string | null;
  breakdown: PriceBreakdown | null;
  distanceKm: number | null;
  createdAt: string | null;
  /** true si le devis vient d'être figé pour cette mission. */
  persisted: boolean;
};

/**
 * Devis d'une mission : renvoie le devis historisé s'il existe,
 * sinon le calcule côté serveur et le fige.
 * Lecture protégée par RLS (client, dépanneur concerné, entreprise, admin).
 */
export const getOrCreateMissionQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { missionId: string }) => data)
  .handler(async ({ data, context }): Promise<MissionQuote> => {
    const ctx = context as unknown as Ctx;

    const { data: existing } = await ctx.supabase
      .from("quotes")
      .select("*")
      .eq("mission_id", data.missionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id,
        breakdown: (existing.breakdown ?? null) as PriceBreakdown | null,
        distanceKm: existing.distance_km == null ? null : Number(existing.distance_km),
        createdAt: existing.created_at,
        persisted: false,
      };
    }

    // La mission doit être visible par l'utilisateur (RLS) avant tout calcul.
    const { data: mission } = await ctx.supabase
      .from("missions")
      .select(
        "id, client_id, category, priority, distance_km, latitude, longitude, operator_id, company_id",
      )
      .eq("id", data.missionId)
      .maybeSingle();
    if (!mission) throw new Error("Mission introuvable");

    const { buildMissionQuote, persistQuote, resolveRule } = await import("@/lib/quote-engine.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const computed = await buildMissionQuote(supabaseAdmin, mission as any);
    if (!computed) return { id: null, breakdown: null, distanceKm: null, createdAt: null, persisted: false };

    const applicable = await resolveRule(supabaseAdmin, mission as any);
    await persistQuote(supabaseAdmin, mission as any, computed.breakdown, applicable?.rule.price_per_km ?? 0);

    // Le montant estimé de la mission reste écrit par le serveur de confiance.
    await supabaseAdmin
      .from("missions")
      .update({
        estimated_amount: computed.breakdown.total,
        price_breakdown: computed.breakdown as any,
        ...(computed.distanceKm != null && mission.distance_km == null
          ? { distance_km: computed.distanceKm }
          : {}),
      })
      .eq("id", mission.id);

    return {
      id: null,
      breakdown: computed.breakdown,
      distanceKm: computed.distanceKm,
      createdAt: new Date().toISOString(),
      persisted: true,
    };
  });

export type QuotePreview = {
  breakdown: PriceBreakdown | null;
  distanceKm: number | null;
  distanceKnown: boolean;
};

/**
 * Estimation AVANT création de la mission (écran de confirmation automobiliste).
 * La distance provient du dépanneur disponible le plus proche ; si aucune
 * position n'est connue, elle reste inconnue (jamais inventée).
 */
export const previewQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      serviceType: string;
      priority: "NORMAL" | "HIGH" | "EMERGENCY";
      latitude?: number | null;
      longitude?: number | null;
    }) => data,
  )
  .handler(async ({ data }): Promise<QuotePreview> => {
    const { resolveRule, platformFeePercentage } = await import("@/lib/quote-engine.server");
    const { calculateMissionPrice } = await import("@/lib/pricing-core");
    const { computeDistanceKm, toCoords } = await import("@/lib/distance");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const applicable = await resolveRule(supabaseAdmin, {
      category: data.serviceType as any,
      operator_id: null,
      company_id: null,
    });
    if (!applicable) return { breakdown: null, distanceKm: null, distanceKnown: false };

    let distanceKm: number | null = null;
    const clientCoords = toCoords(data.latitude ?? null, data.longitude ?? null);
    if (clientCoords) {
      const { data: operators } = await supabaseAdmin
        .from("operators")
        .select("last_latitude, last_longitude")
        .eq("verification", "VERIFIED")
        .neq("availability", "UNAVAILABLE");
      const distances: number[] = [];
      for (const o of operators ?? []) {
        const coords = toCoords(o.last_latitude, o.last_longitude);
        if (!coords) continue;
        const { km } = await computeDistanceKm(coords, clientCoords);
        if (km != null) distances.push(km);
      }
      if (distances.length > 0) distanceKm = Math.min(...distances);
    }

    const feePct = await platformFeePercentage(supabaseAdmin);
    const breakdown = calculateMissionPrice({
      serviceType: data.serviceType as any,
      priority: data.priority,
      distanceKm,
      rule: applicable.rule,
      source: applicable.source,
      platformFeePercentage: feePct,
    });
    return { breakdown, distanceKm, distanceKnown: distanceKm != null };
  });
