import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
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

export const Route = createFileRoute("/_authenticated/entreprise/missions")({
  head: () => ({
    meta: [
      { title: "Missions entreprise — TowIA" },
      { name: "description", content: "Nouvelles missions, interventions en cours et historique de votre entreprise." },
      { property: "og:title", content: "Missions entreprise — TowIA" },
      { property: "og:description", content: "Suivi des missions de votre entreprise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyMissions,
});

const IN_PROGRESS: MissionStatus[] = ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"];
const HISTORY: MissionStatus[] = ["COMPLETED", "CANCELLED", "DISPUTED"];

function vehicleLabel(m: { vehicle_make?: string | null; vehicle_model?: string | null; vehicle_year?: number | null }) {
  const v = [m.vehicle_make, m.vehicle_model, m.vehicle_year].filter(Boolean).join(" ");
  return v || "Véhicule non précisé";
}

function CompanyMissions() {
  const company = useCompany();
  const companyId = company.data?.id;
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const qc = useQueryClient();

  // Suivi en direct : tout changement d'une mission de l'entreprise rafraîchit la liste.
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`company-missions-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missions", filter: `company_id=eq.${companyId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["company-missions-all", companyId] });
          void qc.invalidateQueries({ queryKey: ["company-available-missions", companyId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const available = useQuery({
    queryKey: ["company-available-missions", companyId],
    enabled: !!companyId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("company_available_missions", {});
      if (error) throw error;
      return data ?? [];
    },
  });

  const missions = useQuery({
    queryKey: ["company-missions-all", companyId],
    enabled: !!companyId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*, operators(first_name, last_name, professional_name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = missions.data ?? [];
  const current = list.filter((m) => IN_PROGRESS.includes(m.status as MissionStatus));
  const history = list.filter(
    (m) => HISTORY.includes(m.status as MissionStatus) && inPeriod(m.created_at, period),
  );

  return (
    <AppShell title="Missions" subtitle="Toutes les interventions" nav={COMPANY_NAV}>
      <div className="space-y-6">
        <Section title="Nouvelles missions" description="Missions en recherche d'un professionnel">
          {(available.data ?? []).length === 0 ? (
            <EmptyState title="Aucune nouvelle mission" description="Les demandes disponibles apparaîtront ici." />
          ) : (
            <ul className="space-y-3">
              {available.data!.map((m) => (
                <li key={m.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                      <p className="text-sm">{[m.address, m.postal_code, m.city].filter(Boolean).join(", ") || "Adresse à confirmer"}</p>
                      <p className="text-xs text-muted-foreground">{vehicleLabel(m)}</p>
                      {m.description ? <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p> : null}
                      <p className="text-xs">
                        Distance : {m.distance_km != null ? `${Number(m.distance_km).toLocaleString("fr-FR")} km` : "à confirmer"}
                        {" · "}Estimation : {formatAmount(m.estimated_amount)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <PriorityBadge priority={m.priority as MissionPriority} />
                        <StatusBadge status={m.status as MissionStatus} />
                      </div>
                      <Button asChild size="sm" className="rounded-xl bg-gradient-primary">
                        <Link to="/entreprise/mission/$id" params={{ id: m.id }}>VOIR LA MISSION</Link>
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Missions en cours">
          {current.length === 0 ? (
            <EmptyState title="Aucune mission en cours" />
          ) : (
            <ul className="space-y-2">
              {current.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
                  <div className="space-y-0.5">
                    <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                    <p className="text-xs text-muted-foreground">
                      Dépanneur : {m.operators ? m.operators.professional_name || [m.operators.first_name, m.operators.last_name].filter(Boolean).join(" ") : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.address || m.city || "—"} · {formatDate(m.accepted_at ?? m.created_at)}</p>
                    <p className="text-xs">{formatAmount(m.amount ?? m.estimated_amount)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.status as MissionStatus} />
                    <Button asChild size="sm" variant="secondary" className="rounded-xl">
                      <Link to="/entreprise/mission/$id" params={{ id: m.id }}>Voir le suivi</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Historique"
          action={
            <div className="flex flex-wrap gap-1">
              {PERIOD_OPTIONS.map((p) => (
                <Button key={p.value} size="sm" variant={period === p.value ? "default" : "secondary"} className="rounded-xl" onClick={() => setPeriod(p.value)}>
                  {p.label}
                </Button>
              ))}
            </div>
          }
        >
          {history.length === 0 ? (
            <EmptyState title="Aucune mission" />
          ) : (
            <ul className="space-y-2">
              {history.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
                  <div>
                    <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(m.created_at)} · {formatAmount(m.amount ?? m.estimated_amount)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.status as MissionStatus} />
                    <Button asChild size="sm" variant="ghost" className="rounded-xl">
                      <Link to="/entreprise/mission/$id" params={{ id: m.id }}>Détail</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
