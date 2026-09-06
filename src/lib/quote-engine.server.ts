/**
 * TowIA — moteur de devis centralisé (serveur uniquement).
 * Le prix affiché au client et au dépanneur provient toujours d'ici.
 */
import {
  calculateMissionPrice,
  clampPercentage,
  type PriceBreakdown,
  type PricingRule,
} from "@/lib/pricing-core";
import { computeDistanceKm, toCoords } from "@/lib/distance";
import type { MissionCategory, MissionPriority } from "@/lib/towia";

type AnyClient = any;

export function toPricingRule(row: any): PricingRule {
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

export type MissionForQuote = {
  id: string;
  category: MissionCategory;
  priority: MissionPriority;
  distance_km: number | null;
  latitude: number | null;
  longitude: number | null;
  operator_id: string | null;
  company_id: string | null;
};

/** Distance réelle retenue pour le devis : jamais inventée. */
export async function resolveMissionDistanceKm(
  client: AnyClient,
  mission: MissionForQuote,
): Promise<number | null> {
  if (mission.distance_km != null && Number.isFinite(Number(mission.distance_km))) {
    return Number(mission.distance_km);
  }

  const clientCoords = toCoords(mission.latitude, mission.longitude);
  if (!clientCoords) return null;

  // Position du dépanneur assigné, sinon de la meilleure proposition en cours.
  let operatorId = mission.operator_id;
  if (!operatorId) {
    const { data: offer } = await client
      .from("mission_offers")
      .select("operator_id, distance_km, score")
      .eq("mission_id", mission.id)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (offer?.distance_km != null) return Number(offer.distance_km);
    operatorId = offer?.operator_id ?? null;
  }
  if (!operatorId) return null;

  const { data: operator } = await client
    .from("operators")
    .select("last_latitude, last_longitude")
    .eq("id", operatorId)
    .maybeSingle();

  const operatorCoords = toCoords(operator?.last_latitude, operator?.last_longitude);
  const { km } = await computeDistanceKm(operatorCoords, clientCoords);
  return km;
}

/** Règle applicable : tarif du professionnel s'il existe, sinon grille TowIA. */
export async function resolveRule(
  client: AnyClient,
  mission: Pick<MissionForQuote, "category" | "operator_id" | "company_id">,
): Promise<{ rule: PricingRule; source: "operator" | "platform" } | null> {
  if (mission.operator_id || mission.company_id) {
    let q = client
      .from("operator_pricing")
      .select("*")
      .eq("service_type", mission.category)
      .eq("active", true);
    q = mission.operator_id
      ? q.eq("operator_id", mission.operator_id)
      : q.eq("company_id", mission.company_id);
    const { data } = await q.limit(1).maybeSingle();
    if (data) return { rule: toPricingRule(data), source: "operator" };
  }

  const { data } = await client
    .from("pricing_rules")
    .select("*")
    .eq("service_type", mission.category)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { rule: toPricingRule(data), source: "platform" };
}

export async function platformFeePercentage(client: AnyClient): Promise<number> {
  const { data } = await client
    .from("platform_settings")
    .select("value")
    .eq("key", "platform_fee_percentage")
    .maybeSingle();
  return clampPercentage(Number(data?.value ?? 10));
}

/** Calcul complet du devis d'une mission (source de vérité). */
export async function buildMissionQuote(
  client: AnyClient,
  mission: MissionForQuote,
): Promise<{ breakdown: PriceBreakdown; distanceKm: number | null } | null> {
  const [applicable, feePct, distanceKm] = await Promise.all([
    resolveRule(client, mission),
    platformFeePercentage(client),
    resolveMissionDistanceKm(client, mission),
  ]);
  if (!applicable) return null;

  const breakdown = calculateMissionPrice({
    serviceType: mission.category,
    priority: mission.priority,
    distanceKm,
    rule: applicable.rule,
    source: applicable.source,
    platformFeePercentage: feePct,
  });
  return { breakdown, distanceKm };
}

/** Enregistre le devis (figé) associé à une mission. */
export async function persistQuote(
  admin: AnyClient,
  mission: MissionForQuote,
  breakdown: PriceBreakdown,
  rulePricePerKm: number,
): Promise<void> {
  await admin.from("quotes").insert({
    mission_id: mission.id,
    operator_id: mission.operator_id,
    service_type: mission.category,
    rule_name: breakdown.rule_name,
    source: breakdown.source,
    base_price: breakdown.base_price,
    distance_km: breakdown.distance_km,
    price_per_km: rulePricePerKm,
    distance_price: breakdown.distance_price,
    supplements: breakdown.surcharges as unknown as Record<string, unknown>,
    minimum_applied: breakdown.minimum_applied,
    total_estimate: breakdown.total,
    currency: breakdown.currency,
    breakdown: breakdown as unknown as Record<string, unknown>,
  });
}
