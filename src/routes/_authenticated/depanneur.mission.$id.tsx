import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Navigation, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section, EmptyState, StatusBadge, PriorityBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_LABELS,
  formatAmount,
  formatDate,
  splitAmount,
  type MissionPriority,
  type MissionStatus,
} from "@/lib/towia";
import {
  OPERATOR_STEPS,
  acceptOffer,
  advanceMissionStatus,
  declineOffer,
  haversineKm,
  navigationUrl,
} from "@/lib/operator";
import { useMissionRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated/depanneur/mission/$id")({
  head: () => ({
    meta: [
      { title: "Détail de la mission — TowIA" },
      { name: "description", content: "Détail de l'intervention, suivi du statut et compte rendu." },
      { property: "og:title", content: "Détail de la mission — TowIA" },
      { property: "og:description", content: "Suivi d'intervention côté dépanneur." },
    ],
  }),
  component: OperatorMissionDetail,
});

function OperatorMissionDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState({
    work_done: "",
    distance_km: "",
    amount: "",
    operator_comment: "",
  });
  const [proofFiles, setProofFiles] = useState<File[]>([]);

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

  const mission = useQuery({
    queryKey: ["operator-mission", id],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const offer = useQuery({
    queryKey: ["operator-mission-offer", id, operator.data?.id],
    enabled: !!operator.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_offers")
        .select("*")
        .eq("mission_id", id)
        .eq("operator_id", operator.data!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const client = useQuery({
    queryKey: ["mission-client", mission.data?.client_id],
    enabled: !!mission.data?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("id", mission.data!.client_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const analysis = useQuery({
    queryKey: ["mission-analysis", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_ai_analysis")
        .select("*")
        .eq("mission_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const photos = useQuery({
    queryKey: ["mission-photos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_photos")
        .select("storage_path")
        .eq("mission_id", id);
      if (error) throw error;
      const signed = await Promise.all(
        (data ?? []).map(async (p) => {
          const { data: url } = await supabase.storage
            .from("mission-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { url: url?.signedUrl ?? "" };
        }),
      );
      return signed.filter((p) => p.url);
    },
  });

  const events = useQuery({
    queryKey: ["mission-events", id],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_events")
        .select("*")
        .eq("mission_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const m = mission.data;
  useMissionRealtime(id, [
    ["operator-mission", id],
    ["mission-events", id],
    ["operator-mission-offer", id, operator.data?.id],
  ]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["operator-mission", id] });
    void queryClient.invalidateQueries({ queryKey: ["mission-events", id] });
    void queryClient.invalidateQueries({ queryKey: ["operator-mission-offer", id] });
    void queryClient.invalidateQueries({ queryKey: ["operator-missions", operator.data?.id] });
    void queryClient.invalidateQueries({ queryKey: ["operator-offers", operator.data?.id] });
  };

  if (mission.isLoading) {
    return (
      <AppShell title="Mission" nav={OPERATOR_NAV}>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </AppShell>
    );
  }

  if (!m) {
    return (
      <AppShell title="Mission" nav={OPERATOR_NAV}>
        <EmptyState title="Mission introuvable" description="Cette mission ne vous est pas accessible." />
      </AppShell>
    );
  }

  const isMine = m.operator_id === operator.data?.id;
  const step = isMine ? OPERATOR_STEPS[m.status] : undefined;
  const distance =
    offer.data?.distance_km ??
    haversineKm(
      { latitude: operator.data?.last_latitude, longitude: operator.data?.last_longitude },
      { latitude: m.latitude, longitude: m.longitude },
    );
  const navUrl = navigationUrl(m.latitude, m.longitude, m.address);

  const onAccept = async () => {
    if (!offer.data) return;
    setBusy(true);
    const error = await acceptOffer({
      offerId: offer.data.id,
      missionId: m.id,
      operatorId: operator.data!.id,
      companyId: operator.data?.company_id ?? null,
      actorId: user!.id,
      clientId: m.client_id,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Mission acceptée");
    refresh();
  };

  const onDecline = async () => {
    if (!offer.data) return;
    setBusy(true);
    const error = await declineOffer({ offerId: offer.data.id, missionId: m.id, actorId: user!.id });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Proposition refusée");
    void navigate({ to: "/depanneur/dashboard" });
  };

  const onAdvance = async () => {
    if (!step) return;
    if (step.confirm && !window.confirm(step.confirm)) return;
    setBusy(true);
    const error = await advanceMissionStatus({
      missionId: m.id,
      clientId: m.client_id,
      actorId: user!.id,
      previous: m.status as MissionStatus,
      next: step.next,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    refresh();
  };

  const uploadProofs = async () => {
    for (const file of proofFiles) {
      const path = `${user!.id}/${m.id}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("mission-photos").upload(path, file);
      if (error) {
        toast.error(error.message);
        continue;
      }
      await supabase.from("mission_photos").insert({
        mission_id: m.id,
        user_id: user!.id,
        storage_path: path,
      });
    }
  };

  const onComplete = async () => {
    if (!report.work_done.trim()) {
      toast.error("Indiquez l'intervention réalisée.");
      return;
    }
    setBusy(true);
    await uploadProofs();
    const amount = report.amount ? Number(report.amount) : null;
    const error = await advanceMissionStatus({
      missionId: m.id,
      clientId: m.client_id,
      actorId: user!.id,
      previous: m.status as MissionStatus,
      next: "COMPLETED",
      extra: {
        work_done: report.work_done,
        distance_km: report.distance_km ? Number(report.distance_km) : null,
        amount,
        operator_comment: report.operator_comment || null,
      },
    });
    if (!error && amount != null && amount > 0) {
      const { platformFee, professionalAmount } = splitAmount(amount);
      await supabase.from("payments").insert({
        mission_id: m.id,
        client_id: m.client_id,
        operator_id: operator.data!.id,
        amount,
        platform_fee: platformFee,
        professional_amount: professionalAmount,
        status: "PENDING",
      });
    }
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Mission terminée");
    setProofFiles([]);
    refresh();
  };

  return (
    <AppShell
      title={CATEGORY_LABELS[m.category]}
      subtitle={formatDate(m.created_at)}
      nav={OPERATOR_NAV}
    >
      <div className="space-y-5 pb-6">
        <Section title="Intervention">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={m.status as MissionStatus} />
            <PriorityBadge priority={m.priority as MissionPriority} />
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Type" value={CATEGORY_LABELS[m.category]} />
            <Info label="Marque" value={m.vehicle_make} />
            <Info label="Modèle" value={m.vehicle_model} />
            <Info label="Année" value={m.vehicle_year ? String(m.vehicle_year) : null} />
            <Info label="Immatriculation" value={m.vehicle_registration} />
            <Info label="Distance" value={distance != null ? `${distance} km` : null} />
            <Info label="Adresse" value={m.address} />
            <Info label="Ville" value={[m.postal_code, m.city].filter(Boolean).join(" ") || null} />
            <Info
              label="Position GPS"
              value={
                m.latitude != null && m.longitude != null
                  ? `${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}`
                  : null
              }
            />
          </dl>
          {m.description ? (
            <p className="mt-3 rounded-2xl bg-muted/40 p-3 text-sm">{m.description}</p>
          ) : null}
        </Section>

        {analysis.data ? (
          <Section title="Analyse IA" description="Informations recueillies par l'assistant TowIA.">
            <div className="space-y-2 text-sm">
              {analysis.data.summary_for_operator ? (
                <p>{analysis.data.summary_for_operator}</p>
              ) : null}
              {analysis.data.vehicle_summary ? (
                <p className="text-muted-foreground">{analysis.data.vehicle_summary}</p>
              ) : null}
              {(analysis.data.needs ?? []).length > 0 ? (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {analysis.data.needs.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Section>
        ) : null}

        {(photos.data ?? []).length > 0 ? (
          <Section title="Photos">
            <div className="grid grid-cols-3 gap-2">
              {(photos.data ?? []).map((p) => (
                <img
                  key={p.url}
                  src={p.url}
                  alt="Photo de la mission"
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </Section>
        ) : null}

        {!isMine && offer.data?.status === "PENDING" ? (
          <div className="grid gap-2">
            <Button
              className="h-16 rounded-2xl bg-gradient-primary text-base font-semibold"
              disabled={busy}
              onClick={() => void onAccept()}
            >
              ACCEPTER LA MISSION
            </Button>
            <Button
              variant="secondary"
              className="h-14 rounded-2xl text-base font-semibold"
              disabled={busy}
              onClick={() => void onDecline()}
            >
              REFUSER
            </Button>
          </div>
        ) : null}

        {isMine ? (
          <>
            <Section title="Sur le terrain">
              <div className="grid gap-2 sm:grid-cols-2">
                {navUrl ? (
                  <a href={navUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" className="h-14 w-full rounded-2xl font-semibold">
                      <Navigation className="mr-2 size-5" /> NAVIGUER VERS LE CLIENT
                    </Button>
                  </a>
                ) : null}
                {client.data?.phone ? (
                  <a href={`tel:${client.data.phone}`}>
                    <Button variant="secondary" className="h-14 w-full rounded-2xl font-semibold">
                      <Phone className="mr-2 size-5" /> Appeler le client
                    </Button>
                  </a>
                ) : null}
              </div>
              {client.data ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Client : {[client.data.first_name, client.data.last_name].filter(Boolean).join(" ") || "—"}
                </p>
              ) : null}
            </Section>

            {step ? (
              <Button
                className="h-16 w-full rounded-2xl bg-gradient-primary text-base font-semibold"
                disabled={busy}
                onClick={() => void onAdvance()}
              >
                {step.label}
              </Button>
            ) : null}

            {m.status === "IN_PROGRESS" ? (
              <Section title="Terminer la mission" description="Compte rendu d'intervention.">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="work">Intervention réalisée</Label>
                    <Textarea
                      id="work"
                      value={report.work_done}
                      onChange={(e) => setReport((r) => ({ ...r, work_done: e.target.value }))}
                      placeholder="Type d'intervention effectué"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="km">Kilométrage parcouru (km)</Label>
                      <Input
                        id="km"
                        inputMode="decimal"
                        value={report.distance_km}
                        onChange={(e) => setReport((r) => ({ ...r, distance_km: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="amount">Montant de l'intervention (€)</Label>
                      <Input
                        id="amount"
                        inputMode="decimal"
                        value={report.amount}
                        onChange={(e) => setReport((r) => ({ ...r, amount: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="comment">Commentaire</Label>
                    <Textarea
                      id="comment"
                      value={report.operator_comment}
                      onChange={(e) =>
                        setReport((r) => ({ ...r, operator_comment: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="proofs">Preuves d'intervention (photos)</Label>
                    <Input
                      id="proofs"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setProofFiles(Array.from(e.target.files ?? []).slice(0, 5))}
                    />
                    {proofFiles.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {proofFiles.length} photo(s) prête(s) à être envoyée(s).
                      </p>
                    ) : null}
                  </div>
                  <Button
                    className="h-16 w-full rounded-2xl bg-gradient-primary text-base font-semibold"
                    disabled={busy}
                    onClick={() => void onComplete()}
                  >
                    TERMINER LA MISSION
                  </Button>
                </div>
              </Section>
            ) : null}

            {m.status === "COMPLETED" ? (
              <Section title="Compte rendu">
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <Info label="Intervention" value={m.work_done} />
                  <Info label="Kilométrage" value={m.distance_km != null ? `${m.distance_km} km` : null} />
                  <Info label="Montant" value={m.amount != null ? formatAmount(Number(m.amount)) : null} />
                  <Info label="Commentaire" value={m.operator_comment} />
                </dl>
              </Section>
            ) : null}
          </>
        ) : null}

        <Section title="Historique">
          {(events.data ?? []).length === 0 ? (
            <EmptyState title="Aucun événement" />
          ) : (
            <ol className="space-y-2 text-sm">
              {(events.data ?? []).map((e) => (
                <li key={e.id} className="rounded-xl border border-border p-3">
                  <p className="font-medium">{e.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(e.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}
