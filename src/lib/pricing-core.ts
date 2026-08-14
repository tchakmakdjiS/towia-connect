/**
 * TowIA — calculs de tarification purs (utilisables côté client et serveur).
 * UNE seule source de vérité pour le calcul du prix d'une intervention.
 * Aucune distance inventée : si la distance réelle est inconnue, elle vaut null.
 */
import type { MissionCategory, MissionPriority } from "@/lib/towia";

export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 10;

export type PricingRule = {
  service_type: MissionCategory;
  name: string;
  base_price: number;
  price_per_km: number;
  minimum_price: number;
  night_surcharge: number;
  weekend_surcharge: number;
  emergency_surcharge: number;
};

export type PriceBreakdown = {
  currency: string;
  rule_name: string;
  source: "operator" | "platform";
  base_price: number;
  distance_km: number | null;
  distance_price: number;
  surcharges: {
    night: number;
    weekend: number;
    holiday: number;
    emergency: number;
    total: number;
  };
  minimum_applied: boolean;
  subtotal: number;
  platform_fee_percentage: number;
  platform_fee: number;
  operator_amount: number;
  total: number;
};

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Jours fériés français à date fixe (les fériés mobiles sont ignorés côté démo). */
const FIXED_HOLIDAYS = ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"];

export function isHoliday(date: Date): boolean {
  const key = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return FIXED_HOLIDAYS.includes(key);
}

export function isNight(date: Date): boolean {
  const h = date.getHours();
  return h >= 20 || h < 7;
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export type PriceInput = {
  serviceType: MissionCategory;
  /** Distance réelle en km, ou null si inconnue (jamais inventée). */
  distanceKm?: number | null;
  priority?: MissionPriority;
  at?: Date;
  rule: PricingRule;
  source?: "operator" | "platform";
  platformFeePercentage?: number;
  /** Frais supplémentaires justifiés (équipement, véhicule spécifique…). */
  extraFees?: number;
};

/** Calcul central du prix d'une intervention. */
export function calculateMissionPrice(input: PriceInput): PriceBreakdown {
  const at = input.at ?? new Date();
  const rule = input.rule;
  const feePct = clampPercentage(
    input.platformFeePercentage ?? DEFAULT_PLATFORM_FEE_PERCENTAGE,
  );

  const base = Math.max(0, Number(rule.base_price) || 0);
  const distanceKm =
    input.distanceKm != null && Number.isFinite(input.distanceKm) && input.distanceKm >= 0
      ? Number(input.distanceKm)
      : null;
  const distancePrice = distanceKm == null ? 0 : round2(distanceKm * (Number(rule.price_per_km) || 0));

  const night = isNight(at) ? Math.max(0, Number(rule.night_surcharge) || 0) : 0;
  const weekend = isWeekend(at) ? Math.max(0, Number(rule.weekend_surcharge) || 0) : 0;
  const holiday = isHoliday(at) ? Math.max(0, Number(rule.weekend_surcharge) || 0) : 0;
  const emergency =
    input.priority === "EMERGENCY" || input.priority === "HIGH"
      ? Math.max(0, Number(rule.emergency_surcharge) || 0)
      : 0;
  const surchargeTotal = round2(night + weekend + holiday + emergency);

  const extras = Math.max(0, Number(input.extraFees ?? 0) || 0);
  const raw = round2(base + distancePrice + surchargeTotal + extras);
  const minimum = Math.max(0, Number(rule.minimum_price) || 0);
  const subtotal = round2(Math.max(raw, minimum));
  const total = Math.max(0, subtotal);

  const platformFee = Math.min(total, round2((total * feePct) / 100));
  const operatorAmount = round2(Math.max(0, total - platformFee));

  return {
    currency: DEFAULT_CURRENCY,
    rule_name: rule.name,
    source: input.source ?? "platform",
    base_price: round2(base),
    distance_km: distanceKm,
    distance_price: distancePrice,
    surcharges: { night, weekend, holiday, emergency, total: surchargeTotal },
    minimum_applied: raw < minimum,
    subtotal,
    platform_fee_percentage: feePct,
    platform_fee: platformFee,
    operator_amount: operatorAmount,
    total,
  };
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PLATFORM_FEE_PERCENTAGE;
  return Math.min(100, Math.max(0, value));
}

/** Répartition à partir d'un montant total réel (mission terminée). */
export function splitTotal(total: number, feePercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE) {
  const amount = Math.max(0, round2(total));
  const fee = Math.min(amount, round2((amount * clampPercentage(feePercentage)) / 100));
  return { platformFee: fee, operatorAmount: round2(amount - fee) };
}

