import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Siren, Car, History, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section, StatCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { ACTIVE_STATUSES, CATEGORY_LABELS, formatDate, type MissionStatus } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord automobiliste — TowIA" },
      { name: "description", content: "Vos missions, vos véhicules et votre bouton SOS TowIA." },
      { property: "og:title", content: "Tableau de bord automobiliste — TowIA" },
      { property: "og:description", content: "Vos missions et votre bouton SOS TowIA." },
    ],
  }),
  component: ClientDashboard,
});

function ClientDashboard() {
  const { user } = useAuth();

  const missions = useQuery({
    queryKey: ["client-missions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const vehicles = useQuery({
    queryKey: ["client-vehicles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const list = missions.data ?? [];
  const active = list.filter((m) => ACTIVE_STATUSES.includes(m.status as MissionStatus));
  const last = list[0];

  return (
    <AppShell title="Besoin d'aide ?" subtitle="Espace automobiliste" nav={CLIENT_NAV}>
      <div className="space-y-6">
        <div className="surface-card flex flex-col items-center gap-4 p-8 text-center">
          <Button
            asChild
            className="animate-sos-pulse size-40 rounded-full bg-gradient-primary text-lg font-bold shadow-elevated sm:size-48"
          >
            <Link to="/client/sos">
              <span className="flex flex-col items-center gap-2">
                <Siren className="size-9" />
                SOS ASSISTANCE
              </span>
            </Link>
          </Button>
          <p className="max-w-sm text-sm text-muted-foreground">
            Un problème avec votre véhicule ? TowIA vous accompagne.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Missions en cours"
            value={active.length}
            icon={<Activity className="size-5" />}
          />
          <StatCard
            label="Historique"
            value={list.length}
            icon={<History className="size-5" />}
          />
          <StatCard
            label="Véhicules enregistrés"
            value={vehicles.data?.length ?? 0}
            icon={<Car className="size-5" />}
          />
        </div>

        <Section title="Dernière mission">
          {last ? (
            <Link
              to="/client/mission/$id"
              params={{ id: last.id }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 hover:border-primary"
            >
              <div>
                <p className="font-medium">{CATEGORY_LABELS[last.category]}</p>
                <p className="text-xs text-muted-foreground">{formatDate(last.created_at)}</p>
              </div>
              <StatusBadge status={last.status as MissionStatus} />
            </Link>
          ) : (
            <EmptyState
              title="Aucune mission pour le moment"
              description="Votre première demande d'assistance apparaîtra ici."
            />
          )}
        </Section>

        <Section
          title="Missions en cours"
          action={
            <Button asChild variant="secondary" size="sm" className="rounded-xl">
              <Link to="/client/missions">Tout voir</Link>
            </Button>
          }
        >
          {active.length === 0 ? (
            <EmptyState title="Aucune mission en cours" />
          ) : (
            <ul className="space-y-2">
              {active.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/client/mission/$id"
                    params={{ id: m.id }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4 hover:border-primary"
                  >
                    <span className="text-sm">{CATEGORY_LABELS[m.category]}</span>
                    <StatusBadge status={m.status as MissionStatus} />
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
