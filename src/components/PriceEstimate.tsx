import { formatAmount } from "@/lib/towia";
import type { PriceBreakdown } from "@/lib/pricing-core";

/** Affichage unique et cohérent d'une estimation de prix TowIA. */
export function PriceEstimate({
  breakdown,
  title = "Estimation de votre intervention",
  testMode = false,
}: {
  breakdown: PriceBreakdown;
  title?: string;
  testMode?: boolean;
}) {
  const s = breakdown.surcharges;
  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</p>
      <Line label="Service" value={breakdown.rule_name} />
      <Line label="Forfait" value={formatAmount(breakdown.base_price, breakdown.currency)} />
      <Line
        label="Distance"
        value={breakdown.distance_km == null ? "Distance à confirmer" : `${breakdown.distance_km.toFixed(1)} km`}
      />
      {breakdown.distance_km != null ? (
        <Line label="Prix distance" value={formatAmount(breakdown.distance_price, breakdown.currency)} />
      ) : null}
      {s.emergency > 0 ? (
        <Line label="Supplément urgence" value={formatAmount(s.emergency, breakdown.currency)} />
      ) : null}
      {s.night > 0 ? <Line label="Supplément nuit" value={formatAmount(s.night, breakdown.currency)} /> : null}
      {s.weekend > 0 ? (
        <Line label="Supplément weekend" value={formatAmount(s.weekend, breakdown.currency)} />
      ) : null}
      {s.holiday > 0 ? (
        <Line label="Supplément jour férié" value={formatAmount(s.holiday, breakdown.currency)} />
      ) : null}
      {breakdown.minimum_applied ? (
        <p className="text-xs text-muted-foreground">Tarif minimum du service appliqué.</p>
      ) : null}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold">TOTAL ESTIMÉ</span>
        <span className="text-xl font-bold text-primary">
          {formatAmount(breakdown.total, breakdown.currency)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Commission TowIA ({breakdown.platform_fee_percentage} %) :{" "}
        {formatAmount(breakdown.platform_fee, breakdown.currency)} · Professionnel :{" "}
        {formatAmount(breakdown.operator_amount, breakdown.currency)}
      </p>
      <p className="text-xs text-muted-foreground">
        Le montant final peut évoluer si les conditions de l'intervention changent.
      </p>
      {testMode ? (
        <p className="rounded-xl bg-warning/15 px-3 py-2 text-xs font-medium text-warning">
          Mode test — aucun paiement réel.
        </p>
      ) : null}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
