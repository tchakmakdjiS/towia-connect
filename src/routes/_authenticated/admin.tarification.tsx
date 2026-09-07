import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriceEstimate } from "@/components/PriceEstimate";
import { CATEGORY_LABELS, MISSION_CATEGORIES, formatDate, type MissionCategory } from "@/lib/towia";
import {
  calculateMissionPrice,
  toRule,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  clampPercentage,
} from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/tarification")({
  head: () => ({
    meta: [
      { title: "Tarification — Administration TowIA" },
      {
        name: "description",
        content:
          "Créer et modifier les règles tarifaires TowIA : prix de base, prix au kilomètre, minimum et suppléments.",
      },
      { property: "og:title", content: "Tarification — Administration TowIA" },
      {
        property: "og:description",
        content: "Configuration des règles de tarification et aperçu du calcul.",
      },
    ],
  }),
  component: AdminPricingRules,
});

const FIELDS = [
  { key: "base_price", label: "Prix de base" },
  { key: "price_per_km", label: "Prix / km" },
  { key: "minimum_price", label: "Minimum de facturation" },
  { key: "night_surcharge", label: "Supplément nuit" },
  { key: "weekend_surcharge", label: "Supplément weekend / férié" },
  { key: "emergency_surcharge", label: "Supplément urgence" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const EMPTY_FORM: Record<FieldKey, string> = {
  base_price: "0",
  price_per_km: "0",
  minimum_price: "0",
  night_surcharge: "0",
  weekend_surcharge: "0",
  emergency_surcharge: "0",
};

function AdminPricingRules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newRule, setNewRule] = useState<{ name: string; service_type: MissionCategory } & Record<FieldKey, string>>({
    name: "",
    service_type: "REMORQUAGE",
    ...EMPTY_FORM,
  });

  const rules = useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_rules").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const fee = useQuery({
    queryKey: ["platform-fee"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "platform_fee_percentage")
        .maybeSingle();
      return clampPercentage(Number(data?.value ?? DEFAULT_PLATFORM_FEE_PERCENTAGE));
    },
  });

  const log = async (action: string, entityId: string | null, metadata: Record<string, unknown>) => {
    await supabase.from("activity_logs").insert({
      user_id: user?.id ?? null,
      action,
      entity: "pricing_rules",
      entity_id: entityId,
      metadata: metadata as never,
    });
  };

  const create = async () => {
    if (!newRule.name.trim()) {
      toast.error("Nom de la règle requis");
      return;
    }
    setCreating(true);
    const payload = {
      name: newRule.name.trim(),
      service_type: newRule.service_type,
      active: true,
      ...Object.fromEntries(FIELDS.map((f) => [f.key, Math.max(0, Number(newRule[f.key]) || 0)])),
    };
    const { data, error } = await supabase
      .from("pricing_rules")
      .insert(payload as never)
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("pricing_rule_created", data?.id ?? null, payload);
    toast.success("Règle tarifaire créée");
    setNewRule({ name: "", service_type: "REMORQUAGE", ...EMPTY_FORM });
    void queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
  };

  const save = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("pricing_rules").update(patch as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("pricing_rule_updated", id, patch);
    toast.success("Règle mise à jour");
    void queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
  };

  const list = rules.data ?? [];

  return (
    <AppShell
      title="Tarification"
      subtitle="Règles de calcul des devis TowIA"
      nav={ADMIN_NAV}
    >
      <div className="space-y-6">
        <Section
          title="Nouvelle règle tarifaire"
          description="Un tarif par type d'intervention : prix de base, prix au kilomètre, minimum et suppléments."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Nom de la règle
              <Input
                value={newRule.name}
                placeholder="Remorquage standard"
                onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Type d'intervention
              <select
                value={newRule.service_type}
                onChange={(e) =>
                  setNewRule((r) => ({ ...r, service_type: e.target.value as MissionCategory }))
                }
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {MISSION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {FIELDS.map((f) => (
              <label key={f.key} className="text-xs text-muted-foreground">
                {f.label} (€)
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={newRule[f.key]}
                  onChange={(e) => setNewRule((r) => ({ ...r, [f.key]: e.target.value }))}
                  className="mt-1 rounded-xl"
                />
              </label>
            ))}
          </div>
          <Button
            className="mt-4 rounded-xl bg-gradient-primary"
            disabled={creating}
            onClick={() => void create()}
          >
            Créer la règle
          </Button>
        </Section>

        <Section title="Règles existantes" description="Modifier, activer ou désactiver une règle.">
          {list.length === 0 ? (
            <EmptyState title="Aucune règle tarifaire" />
          ) : (
            <div className="space-y-4">
              {list.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule as never}
                  feePercentage={fee.data ?? DEFAULT_PLATFORM_FEE_PERCENTAGE}
                  onSave={(patch) => void save(rule.id, patch)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

type RuleRow = Record<string, unknown> & {
  id: string;
  name: string;
  service_type: MissionCategory;
  active: boolean;
  updated_at: string;
};

function RuleCard({
  rule,
  feePercentage,
  onSave,
}: {
  rule: RuleRow;
  feePercentage: number;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(rule[f.key] ?? 0)])),
  );
  const [previewKm, setPreviewKm] = useState("15");
  const [urgent, setUrgent] = useState(false);

  const draft = toRule({
    service_type: rule.service_type,
    name: rule.name,
    base_price: Number(values["base_price"] ?? 0) || 0,
    price_per_km: Number(values["price_per_km"] ?? 0) || 0,
    minimum_price: Number(values["minimum_price"] ?? 0) || 0,
    night_surcharge: Number(values["night_surcharge"] ?? 0) || 0,
    weekend_surcharge: Number(values["weekend_surcharge"] ?? 0) || 0,
    emergency_surcharge: Number(values["emergency_surcharge"] ?? 0) || 0,
  });

  const km = previewKm.trim() === "" ? null : Number(previewKm);
  const preview = calculateMissionPrice({
    serviceType: rule.service_type,
    distanceKm: km != null && Number.isFinite(km) ? km : null,
    priority: urgent ? "EMERGENCY" : "NORMAL",
    rule: draft,
    platformFeePercentage: feePercentage,
  });

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{rule.name}</p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[rule.service_type]} · {rule.active ? "Active" : "Inactive"} · modifiée
            le {formatDate(rule.updated_at)}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-xl"
          onClick={() => onSave({ active: !rule.active })}
        >
          {rule.active ? "Désactiver" : "Activer"}
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="text-xs text-muted-foreground">
            {f.label} (€)
            <Input
              type="number"
              min={0}
              step="0.5"
              value={values[f.key] ?? "0"}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="mt-1 rounded-xl"
            />
          </label>
        ))}
      </div>

      <Button
        size="sm"
        className="mt-3 rounded-xl bg-gradient-primary"
        onClick={() =>
          onSave(
            Object.fromEntries(
              FIELDS.map((f) => [f.key, Math.max(0, Number(values[f.key] ?? 0) || 0)]),
            ),
          )
        }
      >
        Enregistrer
      </Button>

      <div className="mt-4 space-y-3 rounded-2xl bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Aperçu du calcul
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Distance simulée (km)
            <Input
              type="number"
              min={0}
              step="1"
              value={previewKm}
              onChange={(e) => setPreviewKm(e.target.value)}
              className="mt-1 w-32 rounded-xl"
            />
          </label>
          <Label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Intervention urgente
          </Label>
        </div>
        <PriceEstimate breakdown={preview} title="Simulation de devis" />
      </div>
    </div>
  );
}
