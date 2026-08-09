import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section, StatusBadge, PriorityBadge, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_LABELS,
  formatDate,
  formatAmount,
  REVIEW_CRITERIA,
  type MissionStatus,
  type MissionPriority,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/client/mission/$id")({
  head: () => ({
    meta: [
      { title: "Détail de la mission — TowIA" },
      { name: "description", content: "Suivi détaillé de votre mission d'assistance TowIA." },
      { property: "og:title", content: "Détail de la mission — TowIA" },
      { property: "og:description", content: "Suivi détaillé de votre mission d'assistance." },
    ],
  }),
  component: ClientMissionDetail,
});

function ClientMissionDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [criteria, setCriteria] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  const mission = useQuery({
    queryKey: ["mission", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const payment = useQuery({
    queryKey: ["mission-payment", id],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("mission_id", id).maybeSingle();
      return data;
    },
  });

  const review = useQuery({
    queryKey: ["mission-review", id],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("*").eq("mission_id", id).maybeSingle();
      return data;
    },
  });

  const submitReview = async () => {
    if (!user || !mission.data || rating === 0) return;
    const { error } = await supabase.from("reviews").insert({
      mission_id: id,
      client_id: user.id,
      operator_id: mission.data.operator_id,
      rating,
      punctuality: criteria["punctuality"] ?? null,
      professionalism: criteria["professionalism"] ?? null,
      speed: criteria["speed"] ?? null,
      quality: criteria["quality"] ?? null,
      communication: criteria["communication"] ?? null,
      comment: comment || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Merci pour votre avis");
    void queryClient.invalidateQueries({ queryKey: ["mission-review", id] });
  };

  const m = mission.data;

  return (
    <AppShell title="Détail de la mission" subtitle="Suivi en direct" nav={CLIENT_NAV}>
      {!m ? (
        <EmptyState title="Mission introuvable" />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <Section title={CATEGORY_LABELS[m.category]} description={formatDate(m.created_at)}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={m.status as MissionStatus} />
              <PriorityBadge priority={m.priority as MissionPriority} />
            </div>
            {m.description ? <p className="mt-4 text-sm">{m.description}</p> : null}
          </Section>

          <Section title="Localisation">
            {m.latitude != null && m.longitude != null ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="size-4 text-primary" />
                  {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                </p>
                <Button asChild variant="secondary" className="rounded-xl">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${m.latitude}&mlon=${m.longitude}#map=16/${m.latitude}/${m.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="mr-2 size-4" /> Ouvrir la carte
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {m.address ?? "Aucune position partagée."}
              </p>
            )}
          </Section>

          <Section title="Chronologie">
            <ul className="space-y-2 text-sm">
              <li>Créée : {formatDate(m.created_at)}</li>
              <li>Acceptée : {formatDate(m.accepted_at)}</li>
              <li>Départ : {formatDate(m.departure_time)}</li>
              <li>Arrivée : {formatDate(m.arrival_at)}</li>
              <li>Terminée : {formatDate(m.completed_at)}</li>
            </ul>
          </Section>

          <Section title="Paiement" description="Intégration Stripe prévue côté serveur.">
            {payment.data ? (
              <div className="space-y-1 text-sm">
                <p>Montant : {formatAmount(Number(payment.data.amount), payment.data.currency)}</p>
                <p>Statut : {payment.data.status}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun paiement enregistré pour cette mission.
              </p>
            )}
          </Section>

          {m.status === "COMPLETED" ? (
            <Section title="Votre avis">
              {review.data ? (
                <p className="text-sm text-muted-foreground">
                  Avis déjà envoyé : {review.data.rating}/5
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} étoiles`}>
                        <Star
                          className={`size-7 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {REVIEW_CRITERIA.map((c) => (
                      <div key={c.key} className="flex items-center justify-between gap-3">
                        <span className="text-sm">{c.label}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              aria-label={`${c.label} ${n}`}
                              onClick={() => setCriteria((prev) => ({ ...prev, [c.key]: n }))}
                              className={`size-6 rounded-md text-xs ${
                                (criteria[c.key] ?? 0) >= n
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Votre commentaire (optionnel)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    className="rounded-xl bg-gradient-primary"
                    disabled={rating === 0}
                    onClick={() => void submitReview()}
                  >
                    Envoyer mon avis
                  </Button>
                </div>
              )}
            </Section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
