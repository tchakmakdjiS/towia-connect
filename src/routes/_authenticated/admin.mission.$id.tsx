import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import {
  CATEGORY_LABELS,
  MISSION_STATUS_LABELS,
  formatAmount,
  formatDate,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";
import { useMissionRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated/admin/mission/$id")({
  head: () => ({
    meta: [
      { title: "Historique de mission — Administration TowIA" },
      {
        name: "description",
        content: "Historique complet d'une mission TowIA : étapes, horaires et auteurs.",
      },
      { property: "og:title", content: "Historique de mission — Administration TowIA" },
      { property: "og:description", content: "Étapes, horaires et auteurs de chaque changement." },
    ],
  }),
  component: AdminMissionDetail,
});

function AdminMissionDetail() {
  const { id } = Route.useParams();

  const mission = useQuery({
    queryKey: ["admin-mission", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["admin-mission-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_events")
        .select("*")
        .eq("mission_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const actorIds = Array.from(
    new Set((events.data ?? []).map((e) => e.actor_id).filter((v): v is string => !!v)),
  );

  const actors = useQuery({
    queryKey: ["admin-mission-actors", id, actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", actorIds);
      return data ?? [];
    },
  });

  useMissionRealtime(id, [
    ["admin-mission", id],
    ["admin-mission-events", id],
  ]);

  const actorName = (actorId: string | null) => {
    if (!actorId) return "Système TowIA";
    const p = (actors.data ?? []).find((a) => a.id === actorId);
    if (!p) return "Utilisateur";
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Utilisateur";
  };

  const m = mission.data;

  return (
    <AppShell title="Historique de la mission" subtitle="Vue administrateur" nav={ADMIN_NAV}>
      {!m ? (
        <EmptyState title="Mission introuvable" />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <Section title={CATEGORY_LABELS[m.category]} description={formatDate(m.created_at)}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={m.status as MissionStatus} />
              <PriorityBadge priority={m.priority as MissionPriority} />
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <Info label="Identifiant" value={m.id} />
              <Info label="Adresse" value={m.address} />
              <Info label="Ville" value={[m.postal_code, m.city].filter(Boolean).join(" ") || null} />
              <Info
                label="Véhicule"
                value={
                  [m.vehicle_make, m.vehicle_model, m.vehicle_year].filter(Boolean).join(" ") || null
                }
              />
              <Info label="Montant" value={m.amount != null ? formatAmount(Number(m.amount)) : null} />
              <Info label="Terminée le" value={m.completed_at ? formatDate(m.completed_at) : null} />
            </dl>
            {m.description ? (
              <p className="mt-3 rounded-2xl bg-muted/40 p-3 text-sm">{m.description}</p>
            ) : null}
          </Section>

          <Section
            title="Historique complet"
            description="Chaque changement de statut avec sa date, son heure et son auteur."
          >
            {(events.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
            ) : (
              <ol className="space-y-4 border-l border-border pl-4">
                {(events.data ?? []).map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                    <p className="font-medium">{e.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.created_at)} · par {actorName(e.actor_id)}
                    </p>
                    {e.previous_status && e.status ? (
                      <p className="text-xs text-muted-foreground">
                        {MISSION_STATUS_LABELS[e.previous_status as MissionStatus]} →{" "}
                        {MISSION_STATUS_LABELS[e.status as MissionStatus]}
                      </p>
                    ) : null}
                    {e.latitude != null && e.longitude != null ? (
                      <p className="text-xs text-muted-foreground">
                        Position : {e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      )}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}
