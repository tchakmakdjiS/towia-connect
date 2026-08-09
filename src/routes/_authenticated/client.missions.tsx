import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import { CATEGORY_LABELS, formatDate, type MissionStatus, type MissionPriority } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/client/missions")({
  head: () => ({
    meta: [
      { title: "Mes missions — TowIA" },
      { name: "description", content: "Historique de vos demandes d'assistance TowIA." },
      { property: "og:title", content: "Mes missions — TowIA" },
      { property: "og:description", content: "Historique de vos demandes d'assistance." },
    ],
  }),
  component: ClientMissions,
});

function ClientMissions() {
  const missions = useQuery({
    queryKey: ["client-missions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Mes missions" subtitle="Historique complet" nav={CLIENT_NAV}>
      <Section title="Toutes les missions">
        {missions.isLoading ? (
          <EmptyState title="Chargement..." />
        ) : (missions.data?.length ?? 0) === 0 ? (
          <EmptyState title="Aucune mission" description="Vos demandes apparaîtront ici." />
        ) : (
          <ul className="space-y-2">
            {missions.data!.map((m) => (
              <li key={m.id}>
                <Link
                  to="/client/mission/$id"
                  params={{ id: m.id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 hover:border-primary"
                >
                  <div>
                    <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={m.priority as MissionPriority} />
                    <StatusBadge status={m.status as MissionStatus} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
