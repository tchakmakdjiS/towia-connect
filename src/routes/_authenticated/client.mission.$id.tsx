import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation, Star, Phone } from "lucide-react";
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
import { MISSION_TIMELINE, TIMELINE_ORDER, URGENCY_LABELS } from "@/lib/sos";
import { PAYMENT_STATUS_LABELS } from "@/lib/pricing";

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
    refetchInterval: 15000,
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

  const events = useQuery({
    queryKey: ["mission-events", id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("mission_events")
        .select("*")
        .eq("mission_id", id)
        .order("created_at");
      return data ?? [];
    },
  });

  const operator = useQuery({
    queryKey: ["mission-operator", mission.data?.operator_id],
    enabled: !!mission.data?.operator_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("operators")
        .select("*")
        .eq("id", mission.data!.operator_id!)
        .maybeSingle();
      return data;
    },
  });

  const offer = useQuery({
    queryKey: ["mission-offer", id, mission.data?.operator_id],
    enabled: !!mission.data?.operator_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("mission_offers")
        .select("distance_km, estimated_arrival")
        .eq("mission_id", id)
        .eq("operator_id", mission.data!.operator_id!)
        .maybeSingle();
      return data;
    },
  });

  const photos = useQuery({
    queryKey: ["mission-photos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("mission_photos")
        .select("storage_path")
        .eq("mission_id", id);
      if (!data) return [];
      const signed = await Promise.all(
        data.map(async (p) => {
          const { data: url } = await supabase.storage
            .from("mission-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { url: url?.signedUrl ?? "" };
        }),
      );
      return signed.filter((p) => p.url);
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

          {m.status === "SEARCHING" || m.status === "PROPOSED" ? (
            <Section
              title="Nous recherchons votre dépanneur"
              description="Recherche d'un professionnel disponible près de vous…"
            >
              <ul className="space-y-2 text-sm">
                <li>📍 {m.address ?? m.city ?? "Position partagée"}</li>
                <li>
                  🚗 {[m.vehicle_make, m.vehicle_model, m.vehicle_year].filter(Boolean).join(" ") || "Véhicule non précisé"}
                </li>
                <li>🔧 {CATEGORY_LABELS[m.category]}</li>
                <li>🚨 Urgence : {URGENCY_LABELS[m.priority as MissionPriority]}</li>
              </ul>
            </Section>
          ) : null}

          {operator.data ? (
            <Section title="Votre dépanneur a accepté la mission">
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {[operator.data.first_name, operator.data.last_name].filter(Boolean).join(" ") ||
                    operator.data.professional_name ||
                    "Professionnel TowIA"}
                </p>
                {operator.data.company_name ? (
                  <p className="text-muted-foreground">{operator.data.company_name}</p>
                ) : null}
                {operator.data.phone ? (
                  <a className="flex items-center gap-2 text-primary" href={`tel:${operator.data.phone}`}>
                    <Phone className="size-4" /> {operator.data.phone}
                  </a>
                ) : null}
                {operator.data.vehicle_type ? (
                  <p className="text-muted-foreground">Véhicule : {operator.data.vehicle_type}</p>
                ) : null}
                {offer.data?.distance_km != null ? (
                  <p className="text-muted-foreground">
                    Distance : {Number(offer.data.distance_km).toFixed(1)} km
                  </p>
                ) : null}
                {offer.data?.estimated_arrival ? (
                  <p className="text-muted-foreground">
                    Arrivée estimée : {formatDate(offer.data.estimated_arrival)}
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}

          {photos.data && photos.data.length > 0 ? (
            <Section title="Photos">
              <div className="grid grid-cols-3 gap-2">
                {photos.data.map((p) => (
                  <img
                    key={p.url}
                    src={p.url}
                    alt="Photo de la panne"
                    className="h-24 w-full rounded-xl border border-border object-cover"
                  />
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="Suivi de la mission">
            <ol className="space-y-3">
              {MISSION_TIMELINE.map((step) => {
                const event = (events.data ?? []).find((e) => e.status === step.status);
                const reached =
                  !!event || TIMELINE_ORDER.indexOf(m.status) >= TIMELINE_ORDER.indexOf(step.status);
                return (
                  <li key={step.status} className="flex items-start gap-3 text-sm">
                    <span className={reached ? "text-success" : "text-muted-foreground"}>
                      {reached ? "✓" : "○"}
                    </span>
                    <span className="flex-1">
                      <span className={reached ? "font-medium" : "text-muted-foreground"}>
                        {step.label}
                      </span>
                      {event ? (
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(event.created_at)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section title="Paiement" description="Paiement sécurisé, aucune donnée bancaire stockée.">
            {payment.data ? (
              <div className="space-y-3 text-sm">
                <p>Montant : {formatAmount(Number(payment.data.amount), payment.data.currency)}</p>
                <p>
                  Statut : {PAYMENT_STATUS_LABELS[payment.data.status] ?? payment.data.status}
                  {payment.data.is_test ? " (mode test)" : ""}
                </p>
                {payment.data.status !== "PAID" && payment.data.status !== "REFUNDED" ? (
                  <Button asChild className="rounded-xl bg-gradient-primary">
                    <Link to="/client/paiement/$id" params={{ id }}>
                      Régler l'intervention
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : m.status === "COMPLETED" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Votre intervention est terminée, il reste à la régler.
                </p>
                <Button asChild className="rounded-xl bg-gradient-primary">
                  <Link to="/client/paiement/$id" params={{ id }}>
                    Payer maintenant
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Aucun paiement enregistré pour cette mission.
                </p>
                <Button asChild variant="secondary" className="rounded-xl">
                  <Link to="/client/paiement/$id" params={{ id }}>
                    Voir l'estimation
                  </Link>
                </Button>
              </div>
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
