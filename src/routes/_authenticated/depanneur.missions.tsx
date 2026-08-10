import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section, EmptyState, PriorityBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, formatDate, type MissionPriority } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/depanneur/missions")({
  head: () => ({
    meta: [
      { title: "Missions disponibles — TowIA" },
      { name: "description", content: "Propositions de missions envoyées par le dispatch TowIA." },
      { property: "og:title", content: "Missions disponibles — TowIA" },
      { property: "og:description", content: "Propositions de missions du dispatch TowIA." },
    ],
  }),
  component: OperatorMissions,
});

function OperatorMissions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const offers = useQuery({
    queryKey: ["operator-offers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_offers")
        .select("*, missions(*)")
        .eq("operator_id", user!.id)
        .eq("status", "PENDING")
        .order("offered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const respond = async (offerId: string, missionId: string, accept: boolean) => {
    const { error } = await supabase
      .from("mission_offers")
      .update({ status: accept ? "ACCEPTED" : "DECLINED", responded_at: new Date().toISOString() })
      .eq("id", offerId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (accept) {
      const { error: missionError } = await supabase
        .from("missions")
        .update({
          status: "ACCEPTED",
          operator_id: user!.id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", missionId);
      if (missionError) {
        toast.error(missionError.message);
        return;
      }
      toast.success("Mission acceptée");
    } else {
      toast.success("Proposition refusée");
    }
    void queryClient.invalidateQueries({ queryKey: ["operator-offers", user?.id] });
  };

  const list = offers.data ?? [];

  return (
    <AppShell title="Missions disponibles" subtitle="Propositions du dispatch" nav={OPERATOR_NAV}>
      <Section title="Propositions en attente">
        {list.length === 0 ? (
          <EmptyState
            title="Aucune proposition"
            description="Les missions proposées par le dispatch apparaîtront ici."
          />
        ) : (
          <ul className="space-y-3">
            {list.map((offer) => {
              const m = offer.missions;
              if (!m) return null;
              return (
                <li key={offer.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                    </div>
                    <PriorityBadge priority={m.priority as MissionPriority} />
                  </div>
                  {m.description ? <p className="mt-2 text-sm">{m.description}</p> : null}
                  {m.address ? (
                    <p className="mt-1 text-sm text-muted-foreground">{m.address}</p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl bg-gradient-primary"
                      onClick={() => void respond(offer.id, m.id, true)}
                    >
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => void respond(offer.id, m.id, false)}
                    >
                      Refuser
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
