/**
 * TowIA — accès aux tarifs (base de données) + ré-export de la logique pure.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  calculateMissionPrice,
  clampPercentage,
  toRule,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  type PriceBreakdown,
  type PricingRule,
} from "@/lib/pricing-core";
import type { MissionCategory, MissionPriority } from "@/lib/towia";

export * from "@/lib/pricing-core";

/** Commission plateforme configurée par l'administration. */
export async function fetchPlatformFeePercentage(): Promise<number> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "platform_fee_percentage")
    .maybeSingle();
  const parsed = Number(data?.value ?? DEFAULT_PLATFORM_FEE_PERCENTAGE);
  return clampPercentage(parsed);
}

/**
 * Tarif applicable : tarif du professionnel s'il existe, sinon tarif général TowIA.
 */
export async function fetchApplicableRule(params: {
  serviceType: MissionCategory;
  operatorId?: string | null;
  companyId?: string | null;
}): Promise<{ rule: PricingRule; source: "operator" | "platform" } | null> {
  if (params.operatorId || params.companyId) {
    let query = supabase
      .from("operator_pricing")
      .select("*")
      .eq("service_type", params.serviceType)
      .eq("active", true);
    query = params.operatorId
      ? query.eq("operator_id", params.operatorId)
      : query.eq("company_id", params.companyId!);
    const { data } = await query.limit(1).maybeSingle();
    if (data) return { rule: toRule(data), source: "operator" };
  }

  const { data: platform } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("service_type", params.serviceType)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!platform) return null;
  return { rule: toRule(platform), source: "platform" };
}

type RuleRow = {
  service_type: string;
  name?: string | null;
  base_price: number | string;
  price_per_km: number | string;
  minimum_price: number | string;
  night_surcharge: number | string;
  weekend_surcharge: number | string;
  emergency_surcharge: number | string;
};

export function toRule(row: RuleRow): PricingRule {
  return {
    service_type: row.service_type as MissionCategory,
    name: row.name ?? "Tarif professionnel",
    base_price: Number(row.base_price),
    price_per_km: Number(row.price_per_km),
    minimum_price: Number(row.minimum_price),
    night_surcharge: Number(row.night_surcharge),
    weekend_surcharge: Number(row.weekend_surcharge),
    emergency_surcharge: Number(row.emergency_surcharge),
  };
}

/** Estimation complète pour une mission/demande. Retourne null si aucun tarif actif. */
export async function estimateMissionPrice(params: {
  serviceType: MissionCategory;
  priority?: MissionPriority;
  distanceKm?: number | null;
  operatorId?: string | null;
  companyId?: string | null;
  at?: Date;
}): Promise<PriceBreakdown | null> {
  const [applicable, feePct] = await Promise.all([
    fetchApplicableRule(params),
    fetchPlatformFeePercentage(),
  ]);
  if (!applicable) return null;
  return calculateMissionPrice({
    serviceType: params.serviceType,
    priority: params.priority ?? "NORMAL",
    distanceKm: params.distanceKm ?? null,
    rule: applicable.rule,
    source: applicable.source,
    platformFeePercentage: feePct,
    at: params.at ?? new Date(),
  });
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  PAID: "Payé",
  FAILED: "Échoué",
  CANCELLED: "Annulé",
  REFUNDED: "Remboursé",
};
