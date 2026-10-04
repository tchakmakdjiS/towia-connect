import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
import { useMissionRealtime } from "@/lib/realtime";
import { Section, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  formatAmount,
  formatDate,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/entreprise/mission/$id")({
  head: () => ({
    meta: [
      { title: "Détail de mission — TowIA Entreprise" },
      { name: "description", content: "Consultez, prenez et attribuez une mission à un dépanneur de votre entreprise." },
      { property: "og:title", content: "Détail de mission — TowIA Entreprise" },
      { property: "og:description", content: "Prendre et attribuer une mission TowIA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyMissionDetail,
});

const TAKEN_MSG = "Cette mission vient d'être prise par un autre professionnel.";

function CompanyMissionDetail() {
  const { id } = Route.useParams();
  const company = useCompany();
  const companyId = company.data?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mission = useQuery({
    queryKey: ["company-mission", id, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: own } = await supabase
        .from("missions")
        .select("*, operators(first_name, last_name, professional_name, user_id, phone, last_latitude, last_longitude, last_position_at)")
        .eq("id", id)
        .eq("company_id", companyId!)
        .maybeSingle();
      if (own) return { kind: "own" as const, m: own };
      const { data, error } = await supabase.rpc("company_available_missions", { _mission_id: id });
      if (error) throw error;
      const m = data?.[0];
      return m ? { kind: "available" as const, m } : null;
    },
  });

  const events = useQuery({
    queryKey: ["company-mission-events", id],
    enabled: mission.data?.kind === "own",
    queryFn: async () => {
      const { data } = await supabase
        .from("mission_events")
        .select("id, label, status, created_at, latitude, longitude, actor_id")
        .eq("mission_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useMissionRealtime(id, [["company-mission", id, companyId], ["company-mission-events", id]]);

  const operators = useQuery({
    queryKey: ["company-operators-assign", companyId],
    enabled: !!companyId && choosing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("id, first_name, last_name, professional_name, availability, is_available, verification, last_latitude, last_longitude")
        .eq("company_id", companyId!)
        .neq("verification", "SUSPENDED")
        .neq("account_status", "DISABLED");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["company-mission", id, companyId] });
    void qc.invalidateQueries({ queryKey: ["company-available-missions", companyId] });
    void qc.invalidateQueries({ queryKey: ["company-missions-all", companyId] });
  };

  const assign = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("company_take_mission", { _mission_id: id, _operator_id: selected });
    setBusy(false);
    if (error) {
      if (error.message.includes("MISSION_ALREADY_TAKEN")) {
        toast.error(TAKEN_MSG);
        setChoosing(false);
        refresh();
      } else if (error.message.includes("OPERATOR_NOT_IN_COMPANY")) {
        toast.error("Ce dépanneur n'appartient pas à votre entreprise.");
      } else {
        toast.error("L'attribution a échoué. Réessayez.");
      }
      return;
    }
    toast.success("Mission attribuée.");
    setChoosing(false);
    refresh();
  };

  const decline = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("company_decline_mission", { _mission_id: id });
    setBusy(false);
    if (error) {
      toast.error("Impossible de refuser la mission.");
      return;
    }
    toast.success("Mission refusée.");
    refresh();
    void navigate({ to: "/entreprise/missions" });
  };

  const data = mission.data;
  const m = data?.m;

  return (
    <AppShell title="Mission" subtitle="Détail de l'intervention" nav={COMPANY_NAV}>
      <div className="space-y-6">
        <Link to="/entreprise/missions" className="text-sm text-muted-foreground hover:text-primary">← Retour aux missions</Link>
        {mission.isLoading || company.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !m ? (
          <EmptyState title="Mission indisponible" description={TAKEN_MSG} />
        ) : (
          <>
            <Section
              title={CATEGORY_LABELS[m.category]}
              action={
                <div className="flex gap-2">
                  <PriorityBadge priority={m.priority as MissionPriority} />
                  <StatusBadge status={m.status as MissionStatus} />
                </div>
              }
            >
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Date" value={formatDate(m.created_at)} />
                <Info label="Adresse" value={[m.address, m.postal_code, m.city].filter(Boolean).join(", ") || "À confirmer"} />
                <Info label="Véhicule" value={[m.vehicle_make, m.vehicle_model, m.vehicle_year].filter(Boolean).join(" ") || "Non précisé"} />
                <Info label="Immatriculation" value={m.vehicle_registration || "—"} />
                <Info label="Distance" value={m.distance_km != null ? `${Number(m.distance_km).toLocaleString("fr-FR")} km` : "À confirmer"} />
                <Info label="Estimation" value={formatAmount(m.estimated_amount)} />
                {data.kind === "own" ? (
                  <Info
                    label="Dépanneur affecté"
                    value={data.m.operators ? data.m.operators.professional_name || [data.m.operators.first_name, data.m.operators.last_name].filter(Boolean).join(" ") : "—"}
                  />
                ) : null}
              </dl>
              {m.description ? <p className="mt-4 rounded-xl bg-muted/40 p-3 text-sm">{m.description}</p> : null}

              {data.kind === "available" && !choosing ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button className="rounded-xl bg-gradient-primary" onClick={() => setChoosing(true)} disabled={busy}>PRENDRE LA MISSION</Button>
                  <Button variant="secondary" className="rounded-xl" onClick={decline} disabled={busy}>REFUSER</Button>
                </div>
              ) : null}
            </Section>

            {data.kind === "available" && choosing ? (
              <Section title="Choisir le dépanneur" description="Sélectionnez qui effectuera l'intervention">
                {(operators.data ?? []).length === 0 ? (
                  <EmptyState title="Aucun dépanneur disponible" description="Ajoutez des dépanneurs dans l'onglet Équipe." />
                ) : (
                  <ul className="space-y-2">
                    {operators.data!.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(o.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition-colors ${selected === o.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        >
                          <p className="font-medium">{o.professional_name || [o.first_name, o.last_name].filter(Boolean).join(" ") || "Dépanneur"}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.availability === "AVAILABLE" ? "Disponible" : o.availability === "ON_MISSION" ? "En mission" : "Indisponible"}
                            {" · "}Validation : {o.verification}
                            {o.last_latitude != null && o.last_longitude != null ? ` · GPS ${o.last_latitude.toFixed(3)}, ${o.last_longitude.toFixed(3)}` : ""}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex gap-2">
                  <Button className="rounded-xl bg-gradient-primary" disabled={!selected || busy} onClick={assign}>Attribuer la mission</Button>
                  <Button variant="secondary" className="rounded-xl" onClick={() => setChoosing(false)}>Annuler</Button>
                </div>
              </Section>
            ) : null}

            {data.kind === "own" ? (
              <CompanyTracking mission={data.m} events={events.data ?? []} />
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

type TrackEvent = {
  id: string;
  label: string;
  status: MissionStatus | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  actor_id: string | null;
};

type TrackMission = {
  status: MissionStatus;
  client_id: string;
  accepted_at: string | null;
  departure_time: string | null;
  arrival_at: string | null;
  completed_at: string | null;
  operators: {
    first_name: string | null;
    last_name: string | null;
    professional_name: string | null;
    user_id: string | null;
    phone: string | null;
    last_latitude: number | null;
    last_longitude: number | null;
    last_position_at: string | null;
  } | null;
};

const TRACK_STEPS: { status: MissionStatus; icon: string; label: string }[] = [
  { status: "ACCEPTED", icon: "✓", label: "Mission acceptée" },
  { status: "EN_ROUTE", icon: "🚗", label: "Dépanneur en route" },
  { status: "ARRIVED", icon: "📍", label: "Dépanneur arrivé" },
  { status: "IN_PROGRESS", icon: "🔧", label: "Intervention en cours" },
  { status: "COMPLETED", icon: "✓", label: "Intervention terminée" },
];

const LIVE_LABELS: Partial<Record<MissionStatus, string>> = {
  ACCEPTED: "Mission acceptée",
  EN_ROUTE: "En route",
  ARRIVED: "Arrivé sur place",
  IN_PROGRESS: "Intervention en cours",
  COMPLETED: "Intervention terminée",
  CANCELLED: "Mission annulée",
  DISPUTED: "Litige",
};

function CompanyTracking({ mission, events }: { mission: TrackMission; events: TrackEvent[] }) {
  const reached = TRACK_STEPS.findIndex((s) => s.status === mission.status);
  const eventTime = (s: MissionStatus) =>
    [...events].reverse().find((e) => e.status === s)?.created_at ?? null;
  const times: Record<string, string | null> = {
    ACCEPTED: mission.accepted_at ?? eventTime("ACCEPTED"),
    EN_ROUTE: mission.departure_time ?? eventTime("EN_ROUTE"),
    ARRIVED: mission.arrival_at ?? eventTime("ARRIVED"),
    IN_PROGRESS: eventTime("IN_PROGRESS"),
    COMPLETED: mission.completed_at ?? eventTime("COMPLETED"),
  };
  const op = mission.operators;
  const opName = op ? op.professional_name || [op.first_name, op.last_name].filter(Boolean).join(" ") : "—";
  const actor = (id: string | null) =>
    !id ? "Système" : id === mission.client_id ? "Automobiliste" : op?.user_id && id === op.user_id ? "Dépanneur" : "Entreprise / plateforme";

  return (
    <>
      <Section title="Suivi en direct" description="Mis à jour automatiquement">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
            {LIVE_LABELS[mission.status] ?? mission.status}
          </span>
          <span className="text-sm text-muted-foreground">Dépanneur : {opName}</span>
          {op?.phone ? (
            <a href={`tel:${op.phone}`} className="text-sm text-primary underline">{op.phone}</a>
          ) : null}
        </div>
        <ol className="space-y-1">
          {TRACK_STEPS.map((s, i) => {
            const done = reached >= i || !!times[s.status];
            return (
              <li key={s.status}>
                <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${done ? "bg-primary/10 text-foreground" : "text-muted-foreground"}`}>
                  <span><span className="mr-2">{s.icon}</span>{s.label}</span>
                  <span className="text-xs">{times[s.status] ? formatDate(times[s.status]) : "—"}</span>
                </div>
                {i < TRACK_STEPS.length - 1 ? <p className="pl-5 text-xs text-muted-foreground">↓</p> : null}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Position du dépanneur :{" "}
          {op?.last_latitude != null && op.last_longitude != null ? (
            <a
              className="text-primary underline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps?q=${op.last_latitude},${op.last_longitude}`}
            >
              {op.last_latitude.toFixed(4)}, {op.last_longitude.toFixed(4)}
              {op.last_position_at ? ` (${formatDate(op.last_position_at)})` : ""}
            </a>
          ) : (
            "non partagée"
          )}
        </p>
      </Section>

      <Section title="Historique des événements">
        {events.length === 0 ? (
          <EmptyState title="Aucun événement" />
        ) : (
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{e.label}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(e.created_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Par : {actor(e.actor_id)}
                  {e.latitude != null && e.longitude != null ? ` · GPS ${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
