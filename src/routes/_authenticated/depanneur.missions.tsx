import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  formatAmount,
  formatDate,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";
import { PERIOD_OPTIONS, inPeriod, type PeriodFilter } from "@/lib/operator";

export const Route = createFileRoute("/_authenticated/depanneur/missions")({
  head: () => ({
    meta: [
      { title: "Mes missions — TowIA" },
      { name: "description", content: "Propositions reçues et historique de vos interventions." },
      { property: "og:title", content: "Mes missions — TowIA" },
      { property: "og:description", content: "Historique des interventions dépanneur." },
    ],
  }),
  component: OperatorMissions;
});

function OperatorMissions() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>("all");

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

  const offers = useQuery({
    queryKey: ["operator-offers", operatorId],
    enabled: !!operatorId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_offers")
        .select("*, missions(*)")
        .eq("operator_id", operatorId!)
        .eq("status", "PENDING")
        .order("offered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const missions = useQuery({
    queryKey: ["operator-missions", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("operator_id", operatorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const history = (missions.data ?? []).filter((m) =>
    inPeriod(m.completed_at ?? m.created_at, period),
  );

  return (
    <AppShell title="Mes missions" subtitle="Propositions et historique" nav={OPERATOR_NAV}>
      <div className="space-y-6">
        <Section title="Propositions en attente">
          {(offers.data ?? []).length === 0 ? (
            <EmptyState title="Aucune proposition en attente" />
          ) : (
            <ul className="space-y-2">
              {(offers.data ?? []).map((o) =>
                o.missions ? (
                  <li key={o.id} className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{CATEGORY_LABELS[o.missions.category]}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(o.offered_at)}
                          {o.distance_km != null ? ` · ${o.distance_km} km` : ""}
                        </p>
                      </div>
                      <PriorityBadge priority={o.missions.priority as MissionPriority} />
                    </div>
                    <Link to="/depanneur/mission/$id" params={{ id: o.missions.id }}>
                      <Button className="mt-3 h-12 w-full rounded-2xl bg-gradient-primary font-semibold">
                        VOIR LA MISSION
                      </Button>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </Section>

        <Section title="Historique" description="Toutes vos interventions.">
          <div className="mb-3 flex flex-wrap gap-2">
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
          {history.length === 0 ? (
            <EmptyState title="Aucune mission sur cette période" />
          ) : (
            <ul className="space-y-2">
              {history.map((m) => (
                <li key={m.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(m.completed_at ?? m.created_at)}
                        {m.city ? ` · ${m.city}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.amount != null ? (
                        <span className="text-sm font-semibold">{formatAmount(Number(m.amount))}</span>
                      ) : null}
                      <StatusBadge status={m.status as MissionStatus} />
                    </div>
                  </div>
                  <Link to="/depanneur/mission/$id" params={{ id: m.id }}>
                    <Button variant="secondary" className="mt-3 h-11 w-full rounded-xl">
                      Détails
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
