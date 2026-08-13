import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Euro, Percent, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section, StatCard, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, formatAmount, formatDate, splitAmount } from "@/lib/towia";
import { PERIOD_OPTIONS, inPeriod, type PeriodFilter } from "@/lib/operator";

export const Route = createFileRoute("/_authenticated/depanneur/revenus")({
  head: () => ({
    meta: [
      { title: "Mes revenus — TowIA" },
      { name: "description", content: "Chiffre d'affaires, commission plateforme et net dépanneur." },
      { property: "og:title", content: "Mes revenus — TowIA" },
      { property: "og:description", content: "Suivi des revenus par période." },
    ],
  }),
  component: OperatorRevenue,
});

function OperatorRevenue() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>("month");

  const operator = useQuery({
    queryKey: ["operator", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const operatorId = operator.data?.id;

  const missions = useQuery({
    queryKey: ["operator-missions", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("operator_id", operatorId!)
        .eq("status", "COMPLETED")
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = (missions.data ?? []).filter((m) =>
    inPeriod(m.completed_at ?? m.created_at, period),
  );
  const gross = rows.reduce((sum, m) => sum + Number(m.amount ?? 0), 0);
  const { platformFee, professionalAmount } = splitAmount(gross);

  return (
    <AppShell title="Mes revenus" subtitle="Suivi de votre activité" nav={OPERATOR_NAV}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? "default" : "secondary"}
              className="rounded-xl"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Chiffre d'affaires" value={formatAmount(gross)} icon={<Euro className="size-5" />} />
          <StatCard
            label="Commission plateforme"
            value={formatAmount(platformFee)}
            icon={<Percent className="size-5" />}
          />
          <StatCard
            label="Net dépanneur"
            value={formatAmount(professionalAmount)}
            icon={<Wallet className="size-5" />}
          />
        </div>

        <Section title="Détail des interventions">
          {rows.length === 0 ? (
            <EmptyState title="Aucune intervention terminée sur cette période" />
          ) : (
            <ul className="space-y-2">
              {rows.map((m) => {
                const split = splitAmount(Number(m.amount ?? 0));
                return (
                  <li key={m.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(m.completed_at ?? m.created_at)}
                          {m.city ? ` · ${m.city}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatAmount(Number(m.amount ?? 0))}</p>
                        <p className="text-xs text-muted-foreground">
                          Net {formatAmount(split.professionalAmount)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
