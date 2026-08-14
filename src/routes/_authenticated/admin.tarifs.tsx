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
import { CATEGORY_LABELS, formatDate } from "@/lib/towia";
import { clampPercentage, DEFAULT_PLATFORM_FEE_PERCENTAGE } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs — Administration TowIA" },
      { name: "description", content: "Gestion des forfaits, prix au kilomètre, suppléments et commission TowIA." },
      { property: "og:title", content: "Tarifs — Administration TowIA" },
      { property: "og:description", content: "Gestion de la grille tarifaire TowIA." },
    ],
  }),
  component: AdminPricing,
});

const FIELDS = [
  { key: "base_price", label: "Forfait" },
  { key: "price_per_km", label: "Prix / km" },
  { key: "minimum_price", label: "Minimum" },
  { key: "night_surcharge", label: "Nuit" },
  { key: "weekend_surcharge", label: "Weekend" },
  { key: "emergency_surcharge", label: "Urgence" },
] as const;

function AdminPricing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fee, setFee] = useState<string>("");

  const rules = useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_rules").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const setting = useQuery({
    queryKey: ["platform-fee"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "platform_fee_percentage")
        .maybeSingle();
      return data;
    },
  });

  const currentFee = Number(setting.data?.value ?? DEFAULT_PLATFORM_FEE_PERCENTAGE);

  const saveRule = async (rule: Record<string, unknown>, patch: Record<string, unknown>) => {
    setSavingId(rule["id"] as string);
    const { error } = await supabase
      .from("pricing_rules")
      .update(patch as never)
      .eq("id", rule["id"] as string);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("activity_logs").insert({
      user_id: user?.id ?? null,
      action: "pricing_rule_updated",
      entity: "pricing_rules",
      entity_id: rule["id"] as string,
      metadata: patch as never,
    });
    toast.success("Tarif mis à jour");
    void queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
  };

  const saveFee = async () => {
    const value = clampPercentage(Number(fee));
    if (!Number.isFinite(Number(fee))) {
      toast.error("Valeur invalide");
      return;
    }
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: value as never, updated_by: user?.id ?? null })
      .eq("key", "platform_fee_percentage");
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("activity_logs").insert({
      user_id: user?.id ?? null,
      action: "platform_fee_updated",
      entity: "platform_settings",
      metadata: { platform_fee_percentage: value },
    });
    toast.success("Commission mise à jour");
    setFee("");
    void queryClient.invalidateQueries({ queryKey: ["platform-fee"] });
  };

  const list = rules.data ?? [];

  return (
    <AppShell title="Tarifs" subtitle="Grille tarifaire et commission" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <Section title="Commission TowIA" description="Pourcentage prélevé sur chaque intervention.">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold text-primary">{currentFee} %</p>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={fee}
              placeholder="Nouveau %"
              onChange={(e) => setFee(e.target.value)}
              className="w-32 rounded-xl"
            />
            <Button className="rounded-xl" disabled={fee === ""} onClick={() => void saveFee()}>
              Enregistrer
            </Button>
          </div>
          {setting.data?.updated_at ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Dernière modification : {formatDate(setting.data.updated_at)}
            </p>
          ) : null}
        </Section>

        <Section title="Tarifs par service" description="Valeurs de démonstration, modifiables.">
          {list.length === 0 ? (
            <EmptyState title="Aucun tarif" />
          ) : (
            <div className="space-y-4">
              {list.map((rule) => (
                <RuleEditor
                  key={rule.id}
                  rule={rule}
                  saving={savingId === rule.id}
                  onSave={(patch) => void saveRule(rule as never, patch)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

function RuleEditor({
  rule,
  saving,
  onSave,
}: {
  rule: Record<string, unknown> & { id: string; name: string; service_type: string; active: boolean; updated_at: string };
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(rule[f.key] ?? 0)])),
  );

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{rule.name}</p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[rule.service_type as never]} ·{" "}
            {rule.active ? "Actif" : "Inactif"} · modifié le {formatDate(rule.updated_at)}
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
        disabled={saving}
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
    </div>
  );
}
