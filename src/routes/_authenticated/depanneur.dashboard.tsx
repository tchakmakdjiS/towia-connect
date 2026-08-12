import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, CheckCircle2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section, StatCard, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ACTIVE_STATUSES,
  CATEGORY_LABELS,
  formatDate,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/depanneur/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord dépanneur — TowIA" },
      { name: "description", content: "Disponibilité, missions en cours et statistiques dépanneur." },
      { property: "og:title", content: "Tableau de bord dépanneur — TowIA" },
      { property: "og:description", content: "Disponibilité et missions en cours." },
    ],
  }),
  component: OperatorDashboard,
});

const NEXT_STATUS: Partial<Record<MissionStatus, { next: MissionStatus; label: string }>> = {
  ACCEPTED: { next: "EN_ROUTE", label: "Je pars maintenant" },
  EN_ROUTE: { next: "ARRIVED", label: "Je suis arrivé" },
  ARRIVED: { next: "IN_PROGRESS", label: "Démarrer l'intervention" },
  IN_PROGRESS: { next: "COMPLETED", label: "Terminer la mission" },
};

function OperatorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const reviews = useQuery({
    queryKey: ["operator-reviews", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating")
        .eq("operator_id", operatorId!);
      if (error) throw error;
      return data;
    },
  });

  const toggleAvailability = async (value: boolean) => {
    if (!operator.data) {
      toast.error("Profil professionnel incomplet.");
      return;
    }
    const { error } = await supabase
      .from("operators")
      .update({ is_available: value })
      .eq("id", operator.data.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["operator", user?.id] });
  };

  const advance = async (missionId: string, next: MissionStatus) => {
    const now = new Date().toISOString();
    const patch = {
      status: next,
      ...(next === "EN_ROUTE" ? { departure_time: now } : {}),
      ...(next === "ARRIVED" ? { arrival_at: now } : {}),
      ...(next === "COMPLETED" ? { completed_at: now } : {}),
    };
    const { error } = await supabase.from("missions").update(patch).eq("id", missionId);
    if (error) {
      toast.error(error.message);
      return;
    }
    const labels: Partial<Record<MissionStatus, string>> = {
      EN_ROUTE: "Dépanneur en route",
      ARRIVED: "Dépanneur arrivé",
      IN_PROGRESS: "Intervention en cours",
      COMPLETED: "Intervention terminée",
    };
    await supabase.from("mission_events").insert({
      mission_id: missionId,
      status: next,
      label: labels[next] ?? next,
      actor_id: user!.id,
    });
    void queryClient.invalidateQueries({ queryKey: ["operator-missions", operatorId] });
  };


  const list = missions.data ?? [];
  const active = list.filter((m) => ACTIVE_STATUSES.includes(m.status as MissionStatus));
  const done = list.filter((m) => m.status === "COMPLETED");
  const ratings = reviews.data ?? [];
  const avg =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : "—";

  return (
    <AppShell title="Espace dépanneur" subtitle="Vos interventions" nav={OPERATOR_NAV}>
      <div className="space-y-6">
        <div className="surface-card flex items-center justify-between gap-4 p-5">
          <div>
            <Label htmlFor="availability" className="text-base">
              Je suis disponible
            </Label>
            <p className="text-xs text-muted-foreground">
              Seules les personnes disponibles reçoivent des propositions.
            </p>
          </div>
          <Switch
            id="availability"
            checked={!!operator.data?.is_available}
            onCheckedChange={(v) => void toggleAvailability(v)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Missions en cours" value={active.length} icon={<Activity className="size-5" />} />
          <StatCard label="Missions terminées" value={done.length} icon={<CheckCircle2 className="size-5" />} />
          <StatCard label="Note moyenne" value={avg} icon={<Star className="size-5" />} />
        </div>

        <Section title="Missions en cours">
          {active.length === 0 ? (
            <EmptyState title="Aucune mission en cours" />
          ) : (
            <ul className="space-y-2">
              {active.map((m) => {
                const step = NEXT_STATUS[m.status as MissionStatus];
                return (
                  <li key={m.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={m.priority as MissionPriority} />
                        <StatusBadge status={m.status as MissionStatus} />
                      </div>
                    </div>
                    {m.address ? (
                      <p className="mt-2 text-sm text-muted-foreground">{m.address}</p>
                    ) : null}
                    {step ? (
                      <Button
                        className="mt-3 rounded-xl bg-gradient-primary"
                        size="sm"
                        onClick={() => void advance(m.id, step.next)}
                      >
                        {step.label}
                      </Button>
                    ) : null}
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
