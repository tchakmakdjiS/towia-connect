import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
import { Section, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import {
  CATEGORY_LABELS,
  formatDate,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/company/missions")({
  head: () => ({
    meta: [
      { title: "Missions entreprise — TowIA" },
      { name: "description", content: "Suivi des missions confiées à votre entreprise." },
      { property: "og:title", content: "Missions entreprise — TowIA" },
      { property: "og:description", content: "Suivi des missions de votre entreprise." },
    ],
  }),
  component: CompanyMissions,
});

function CompanyMissions() {
  const company = useCompany();
  const companyId = company.data?.id;

  const missions = useQuery({
    queryKey: ["company-missions-all", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = missions.data ?? [];

  return (
    <AppShell title="Missions" subtitle="Toutes les interventions" nav={COMPANY_NAV}>
      <Section title="Missions de l'entreprise">
        {list.length === 0 ? (
          <EmptyState title="Aucune mission" />
        ) : (
          <ul className="space-y-2">
            {list.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
              >
                <div>
                  <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={m.priority as MissionPriority} />
                  <StatusBadge status={m.status as MissionStatus} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
