import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Bell, CheckCircle2, Euro, Star, Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section, StatCard, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  formatAmount,
  formatDate,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";
import {
  acceptOffer,
  currentPosition,
  declineOffer,
  haversineKm,
  inPeriod,
} from "@/lib/operator";

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

function OperatorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

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
  const online = !!operator.data?.is_available;

  const missions = useQuery({
    queryKey: ["operator-missions", operatorId],
    enabled: !!operatorId,
    refetchInterval: 20000,
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

  const offers = useQuery({
    queryKey: ["operator-offers", operatorId],
    enabled: !!operatorId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_offers")
        .select("*, missions(*)")
        .eq("operator_id", operatorId!)
        .eq("status", "PENDING")
        .order("offered_at", { ascending: false });
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

  const notifications = useQuery({
    queryKey: ["operator-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  // Position partagée uniquement lorsque le dépanneur est EN LIGNE.
  useEffect(() => {
    if (!online || !operatorId) return;
    let cancelled = false;
    const push = async () => {
      const pos = await currentPosition();
      if (!pos || cancelled) return;
      await supabase
        .from("operators")
        .update({
          last_latitude: pos.latitude,
          last_longitude: pos.longitude,
          last_position_at: new Date().toISOString(),
        })
        .eq("id", operatorId);
    };
    void push();
    const timer = window.setInterval(() => void push(), 120000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [online, operatorId]);

  const verification = operator.data?.verification ?? "PENDING";
  const verified = verification === "VERIFIED";

  const toggleOnline = async () => {
    if (!operator.data) {
      toast.error("Profil professionnel incomplet.");
      return;
    }
    if (!verified) {
      toast.error("Votre compte doit être validé par TowIA avant de recevoir des missions.");
      return;
    }
    const next = !online;
    const { error } = await supabase
      .from("operators")
      .update({
        is_available: next,
        availability: next ? "AVAILABLE" : "UNAVAILABLE",
      })
      .eq("id", operator.data.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Vous êtes EN LIGNE" : "Vous êtes HORS LIGNE");
    void queryClient.invalidateQueries({ queryKey: ["operator", user?.id] });
  };

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["operator-offers", operatorId] });
    void queryClient.invalidateQueries({ queryKey: ["operator-missions", operatorId] });
    void queryClient.invalidateQueries({ queryKey: ["operator-notifications", user?.id] });
  };

  const onAccept = async (offerId: string, mission: { id: string; client_id: string }) => {
    setBusy(offerId);
    const error = await acceptOffer({
      offerId,
      missionId: mission.id,
      operatorId: operatorId!,
      companyId: operator.data?.company_id ?? null,
      actorId: user!.id,
      clientId: mission.client_id,
    });
    setBusy(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Mission acceptée");
    refreshAll();
  };

  const onDecline = async (offerId: string, missionId: string) => {
    setBusy(offerId);
    const error = await declineOffer({ offerId, missionId, actorId: user!.id });
    setBusy(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Proposition refusée");
    refreshAll();
  };

  const list = missions.data ?? [];
  const active = list.filter((m) =>
    ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(m.status),
  );
  const completedToday = list.filter(
    (m) => m.status === "COMPLETED" && inPeriod(m.completed_at, "today"),
  );
  const revenueToday = completedToday.reduce((sum, m) => sum + Number(m.amount ?? 0), 0);
  const completedAll = list.filter((m) => m.status === "COMPLETED");
  const revenueTotal = completedAll.reduce((sum, m) => sum + Number(m.amount ?? 0), 0);
  const ratings = reviews.data ?? [];
  const avg =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : "—";
  const pending = offers.data ?? [];

  return (
    <AppShell title="Espace dépanneur" subtitle="Vos interventions" nav={OPERATOR_NAV}>
      <div className="space-y-6">
        {!verified ? (
          <div
            className={`surface-card border p-4 ${
              verification === "SUSPENDED" ? "border-destructive/50" : "border-warning/50"
            }`}
          >
            <p className="text-sm font-semibold">
              {verification === "SUSPENDED"
                ? "Compte suspendu"
                : verification === "REJECTED"
                  ? "Compte refusé"
                  : "Compte en attente de validation"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {verification === "SUSPENDED"
                ? "Votre compte est suspendu : vous ne recevez plus de missions. Contactez TowIA."
                : verification === "REJECTED"
                  ? "Votre dossier a été refusé. Mettez à jour vos documents depuis votre profil."
                  : "Votre inscription est en cours de vérification par TowIA. Vous ne recevrez aucune mission tant que votre compte n'est pas validé."}
            </p>
          </div>
        ) : null}
        <div className="surface-card p-5">

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Statut</p>
              <p className="mt-1 text-lg font-semibold">
                {online ? "EN LIGNE" : "HORS LIGNE"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {online
                  ? "Vous recevez les missions compatibles."
                  : "Vous ne recevez aucune mission."}
              </p>
            </div>
            <span
              className={`size-4 rounded-full ${online ? "bg-success animate-sos-pulse" : "bg-muted"}`}
              aria-hidden
            />
          </div>
          <Button
            className={`mt-4 h-14 w-full rounded-2xl text-base font-semibold ${
              online ? "" : "bg-gradient-primary"
            }`}
            variant={online ? "secondary" : "default"}
            disabled={!verified}
            onClick={() => void toggleOnline()}
          >
            {!verified
              ? "EN ATTENTE DE VALIDATION"
              : online
                ? "PASSER HORS LIGNE"
                : "🟢 DISPONIBLE — PASSER EN LIGNE"}
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <StatCard label="Missions disponibles" value={pending.length} icon={<Siren className="size-5" />} />
          <StatCard label="Missions en cours" value={active.length} icon={<Activity className="size-5" />} />
          <StatCard
            label="Missions réalisées"
            value={completedAll.length}
            hint={`${completedToday.length} aujourd'hui`}
            icon={<CheckCircle2 className="size-5" />}
          />
          <StatCard
            label="Chiffre d'affaires"
            value={formatAmount(revenueTotal)}
            hint={`${formatAmount(revenueToday)} aujourd'hui`}
            icon={<Euro className="size-5" />}
          />
          <StatCard label="Note moyenne" value={avg} icon={<Star className="size-5" />} />
        </div>

        <Section title="Mon compte professionnel" description="Informations utilisées pour le dispatch.">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Statut du compte</dt>
              <dd className="mt-1 font-medium">
                {verification === "VERIFIED"
                  ? "Validé"
                  : verification === "SUSPENDED"
                    ? "Suspendu"
                    : verification === "REJECTED"
                      ? "Refusé"
                      : "En attente de validation"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Zone d'intervention</dt>
              <dd className="mt-1 font-medium">
                {operator.data?.intervention_zone || "—"}
                {operator.data?.service_radius_km
                  ? ` · ${operator.data.service_radius_km} km`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Type de véhicule</dt>
              <dd className="mt-1 font-medium">{operator.data?.vehicle_type || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Localisation actuelle</dt>
              <dd className="mt-1 font-medium">
                {operator.data?.last_latitude != null && operator.data?.last_longitude != null
                  ? `${operator.data.last_latitude.toFixed(4)}, ${operator.data.last_longitude.toFixed(4)}`
                  : "Non partagée"}
                {operator.data?.last_position_at ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Mise à jour {formatDate(operator.data.last_position_at)}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Services proposés</dt>
              <dd className="mt-1 font-medium">
                {(operator.data?.services ?? []).length > 0
                  ? (operator.data!.services as string[])
                      .map((s) => CATEGORY_LABELS[s as keyof typeof CATEGORY_LABELS] ?? s)
                      .join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/depanneur/profil">
              <Button variant="secondary" className="rounded-xl">Modifier mon profil</Button>
            </Link>
            <Link to="/depanneur/documents">
              <Button variant="secondary" className="rounded-xl">Mes documents</Button>
            </Link>
          </div>
        </Section>


        <Section
          title="Nouvelles missions"
          description="Propositions correspondant à vos critères."
        >
          {!online ? (
            <EmptyState
              title="Vous êtes hors ligne"
              description="Passez EN LIGNE pour recevoir des propositions."
            />
          ) : pending.length === 0 ? (
            <EmptyState title="Aucune proposition en attente" />
          ) : (
            <ul className="space-y-3">
              {pending.map((offer) => {
                const m = offer.missions;
                if (!m) return null;
                const distance =
                  offer.distance_km ??
                  haversineKm(
                    { latitude: operator.data?.last_latitude, longitude: operator.data?.last_longitude },
                    { latitude: m.latitude, longitude: m.longitude },
                  );
                return (
                  <li key={offer.id} className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-primary">🚨 NOUVELLE MISSION</p>
                    <p className="mt-1 text-base font-medium">{CATEGORY_LABELS[m.category]}</p>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {distance != null ? <p>📍 {distance} km</p> : null}
                      {m.vehicle_make || m.vehicle_model ? (
                        <p>🚗 {[m.vehicle_make, m.vehicle_model].filter(Boolean).join(" ")}</p>
                      ) : null}
                      <p>
                        🚨 Urgence : <PriorityBadge priority={m.priority as MissionPriority} />
                      </p>
                    </div>
                    <div className="mt-4 grid gap-2">
                      <Link to="/depanneur/mission/$id" params={{ id: m.id }}>
                        <Button variant="secondary" className="h-11 w-full rounded-xl">
                          Voir les détails
                        </Button>
                      </Link>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className="h-14 rounded-2xl bg-gradient-primary text-base font-semibold"
                          disabled={busy === offer.id}
                          onClick={() => void onAccept(offer.id, m)}
                        >
                          ACCEPTER
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-14 rounded-2xl text-base font-semibold"
                          disabled={busy === offer.id}
                          onClick={() => void onDecline(offer.id, m.id)}
                        >
                          REFUSER
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Missions en cours">
          {active.length === 0 ? (
            <EmptyState title="Aucune mission en cours" />
          ) : (
            <ul className="space-y-2">
              {active.map((m) => (
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
                  <Link to="/depanneur/mission/$id" params={{ id: m.id }}>
                    <Button className="mt-3 h-12 w-full rounded-2xl bg-gradient-primary font-semibold">
                      OUVRIR LA MISSION
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Notifications" description="Liées à votre compte professionnel.">
          {(notifications.data ?? []).length === 0 ? (
            <EmptyState title="Aucune notification" />
          ) : (
            <ul className="space-y-2">
              {(notifications.data ?? []).map((n) => (
                <li key={n.id} className="flex gap-3 rounded-2xl border border-border p-3">
                  <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(n.created_at)}
                    </p>
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
