import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import {
  CATEGORY_LABELS,
  formatDate,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/admin/missions")({
  head: () => ({
    meta: [
      { title: "Missions — Administration TowIA" },
      { name: "description", content: "Toutes les missions de la plateforme TowIA." },
      { property: "og:title", content: "Missions — Administration TowIA" },
      { property: "og:description", content: "Toutes les missions de la plateforme." },
    ],
  }),
  component: AdminMissions,
});

function AdminMissions() {
  const missions = useQuery({
    queryKey: ["admin-missions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = missions.data ?? [];

  return (
    <AppShell title="Missions" subtitle="Vue plateforme" nav={ADMIN_NAV}>
      <Section title="Toutes les missions">
        {list.length === 0 ? (
          <EmptyState title="Aucune mission" />
        ) : (
          <ul className="space-y-2">
            {list.map((m) => (
              <li key={m.id}>
                <Link
                  to="/admin/mission/$id"
                  params={{ id: m.id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 text-sm transition hover:border-primary"
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
