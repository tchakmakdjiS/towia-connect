import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Send,
  Loader2,
  Camera,
  Siren,
  ShieldAlert,
  Sparkles,
  Trash2,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sosNextStep, dispatchMission } from "@/lib/sos.functions";
import { previewQuote, getOrCreateMissionQuote, type QuotePreview } from "@/lib/quotes.functions";
import { PriceEstimate } from "@/components/PriceEstimate";
import { EMPTY_COLLECTED, URGENCY_LABELS, type SosCollected, type SosMessage } from "@/lib/sos";
import { MISSION_CATEGORIES, CATEGORY_LABELS, type MissionCategory } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/client/sos")({
  head: () => ({
    meta: [
      { title: "SOS assistance — TowIA" },
      {
        name: "description",
        content:
          "Demandez une assistance TowIA : assistant IA, localisation, photos et dispatch vers un professionnel.",
      },
      { property: "og:title", content: "SOS assistance — TowIA" },
      { property: "og:description", content: "Demande d'assistance en quelques étapes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SosPage,
});

type Phase = "start" | "chat" | "location" | "photos" | "recap" | "sending";
type PhotoItem = { id: string; path: string; url: string };

const MAX_PHOTOS = 5;

function SosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("start");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SosMessage[]>([]);
  const [collected, setCollected] = useState<SosCollected>(EMPTY_COLLECTED);
  const [options, setOptions] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);

  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [locating, setLocating] = useState(false);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const persist = async (
    id: string,
    patch: TablesUpdate<"assistance_requests">,
  ): Promise<void> => {
    const { error } = await supabase.from("assistance_requests").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };



  /** 1 — bouton SOS : crée une demande "draft" liée à l'utilisateur connecté. */
  const startRequest = async () => {
    if (!user) return;
    setStarting(true);
    const { data, error } = await supabase
      .from("assistance_requests")
      .insert({ user_id: user.id, status: "draft" })
      .select()
      .single();
    setStarting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Impossible de créer la demande");
      return;
    }
    setRequestId(data.id);
    setMessages([{ role: "assistant", content: "Que se passe-t-il ?" }]);
    setOptions([...MISSION_CATEGORIES.map((c) => c.label), "Je ne sais pas"]);
    setPhase("chat");
  };

  const askAssistant = async (nextMessages: SosMessage[], nextCollected: SosCollected) => {
    if (!requestId) return;
    setThinking(true);
    try {
      const step = await sosNextStep({
        data: { messages: nextMessages, collected: nextCollected },
      });
      const merged: SosCollected = {
        ...nextCollected,
        ...step.updates,
        answers: { ...nextCollected.answers, ...(step.updates.answers ?? {}) },
      };
      const withReply: SosMessage[] = [...nextMessages, { role: "assistant", content: step.message }];
      setCollected(merged);
      setMessages(withReply);
      setOptions(step.options);
      await persist(requestId, {
        messages: withReply,
        answers: merged.answers,
        service_type: merged.service_type,
        urgency: merged.urgency,
        problem_description: merged.problem_description,
        vehicle_make: merged.vehicle_make,
        vehicle_model: merged.vehicle_model,
        vehicle_year: merged.vehicle_year,
        vehicle_registration: merged.vehicle_registration,
        safety_notice: merged.safety_notice,
      });
      if (step.done) setPhase("location");
    } catch {
      toast.error("L'assistant est momentanément indisponible. Réessayez.");
    } finally {
      setThinking(false);
    }
  };

  const answer = (value: string) => {
    if (!value.trim() || thinking) return;
    const next: SosMessage[] = [...messages, { role: "user", content: value.trim() }];
    setMessages(next);
    setOptions([]);
    setInput("");

    // Première réponse : on déduit directement la catégorie choisie.
    let nextCollected = collected;
    if (!collected.service_type) {
      const match = MISSION_CATEGORIES.find((c) => c.label === value.trim());
      if (match) nextCollected = { ...collected, service_type: match.value as MissionCategory };
    }
    setCollected(nextCollected);
    void askAssistant(next, nextCollected);
  };

  /** 6 — localisation */
  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setPosition(coords);
        setLocating(false);
        toast.success("Position détectée");
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`,
          );
          if (res.ok) {
            const json = (await res.json()) as {
              display_name?: string;
              address?: Record<string, string>;
            };
            if (json.display_name) setAddress(json.display_name);
            const a = json.address ?? {};
            const town = a["city"] ?? a["town"] ?? a["village"] ?? a["municipality"];
            if (town) setCity(town);
            if (a["postcode"]) setPostalCode(a["postcode"]);
          }
        } catch {
          /* adresse facultative : saisie manuelle possible */
        }
      },
      () => {
        setLocating(false);
        toast.error("Position non partagée. Saisissez l'adresse manuellement.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /** 7 — photos (5 maximum) */
  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !user || !requestId) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error("5 photos maximum");
      return;
    }
    setUploading(true);
    const added: PhotoItem[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      const path = `${user.id}/${requestId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("mission-photos").upload(path, file);
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data: row } = await supabase
        .from("mission_photos")
        .insert({ request_id: requestId, user_id: user.id, storage_path: path })
        .select()
        .single();
      const { data: signed } = await supabase.storage
        .from("mission-photos")
        .createSignedUrl(path, 3600);
      if (row && signed) added.push({ id: row.id, path, url: signed.signedUrl });
    }
    setPhotos((prev) => [...prev, ...added]);
    setUploading(false);
  };

  const removePhoto = async (photo: PhotoItem) => {
    await supabase.storage.from("mission-photos").remove([photo.path]);
    await supabase.from("mission_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  /** 9 — confirmation : la demande devient "pending" et une mission est créée. */
  const confirm = async () => {
    if (!user || !requestId || !collected.service_type) return;
    setSubmitting(true);
    setPhase("sending");

    await persist(requestId, {
      status: "pending",
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      address: address || null,
      city: city || null,
      postal_code: postalCode || null,
    });

    const { data: mission, error } = await supabase
      .from("missions")
      .insert({
        client_id: user.id,
        request_id: requestId,
        category: collected.service_type,
        priority: collected.urgency,
        description: collected.problem_description,
        vehicle_make: collected.vehicle_make,
        vehicle_model: collected.vehicle_model,
        vehicle_year: collected.vehicle_year,
        vehicle_registration: collected.vehicle_registration,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        address: address || null,
        city: city || null,
        postal_code: postalCode || null,
        status: "SEARCHING",
      })
      .select()
      .single();

    if (error || !mission) {
      setSubmitting(false);
      setPhase("recap");
      toast.error(error?.message ?? "Création impossible");
      return;
    }

    await supabase.from("assistance_requests").update({ mission_id: mission.id }).eq("id", requestId);
    await supabase.from("mission_photos").update({ mission_id: mission.id }).eq("request_id", requestId);

    await supabase.from("ai_conversations").insert({
      user_id: user.id,
      mission_id: mission.id,
      messages,
    });

    await supabase.from("mission_ai_analysis").insert({
      mission_id: mission.id,
      category: collected.service_type,
      priority: collected.urgency,
      needs: Object.entries(collected.answers).map(([k, v]) => `${k}: ${v}`),
      vehicle_summary:
        [collected.vehicle_make, collected.vehicle_model, collected.vehicle_year]
          .filter(Boolean)
          .join(" ") || null,
      summary_for_operator: collected.problem_description,
      raw: { answers: collected.answers, safety_notice: collected.safety_notice },
    });

    await supabase.from("mission_events").insert([
      { mission_id: mission.id, status: "CREATED", label: "Demande envoyée", actor_id: user.id },
      { mission_id: mission.id, status: "SEARCHING", label: "Recherche d'un dépanneur" },
    ]);

    await supabase.from("notifications").insert({
      user_id: user.id,
      mission_id: mission.id,
      event: "MISSION_CREATED",
      title: "Demande d'assistance envoyée",
      body: "TowIA recherche un professionnel disponible.",
    });

    try {
      const result = await dispatchMission({ data: { missionId: mission.id } });
      if (result.offers === 0) {
        toast.message("Aucun professionnel disponible pour le moment, la recherche continue.");
      }
    } catch {
      toast.message("Recherche en cours…");
    }

    try {
      await getOrCreateMissionQuote({ data: { missionId: mission.id } });
    } catch {
      // Le devis sera calculé à l'ouverture de la mission.
    }

    setSubmitting(false);
    toast.success("Demande confirmée");
    void navigate({ to: "/client/mission/$id", params: { id: mission.id } });
  };

  const urgencyTone =
    collected.urgency === "EMERGENCY"
      ? "bg-destructive/15 text-destructive"
      : collected.urgency === "HIGH"
        ? "bg-warning/15 text-warning"
        : "bg-muted text-muted-foreground";

  return (
    <AppShell title="SOS assistance" subtitle="Assistant TowIA" nav={CLIENT_NAV}>
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        {collected.safety_notice ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm font-medium text-destructive">{collected.safety_notice}</p>
          </div>
        ) : null}

        {phase === "start" ? (
          <div className="surface-card flex flex-col items-center gap-5 p-8 text-center">
            <Button
              onClick={() => void startRequest()}
              disabled={starting}
              className="animate-sos-pulse size-44 rounded-full bg-gradient-primary text-base font-bold shadow-elevated sm:size-52"
            >
              <span className="flex flex-col items-center gap-2">
                {starting ? (
                  <Loader2 className="size-9 animate-spin" />
                ) : (
                  <Siren className="size-10" />
                )}
                SOS
                <span className="text-xs font-semibold">DEMANDER UNE ASSISTANCE</span>
              </span>
            </Button>
            <p className="max-w-sm text-sm text-muted-foreground">
              TowIA vous pose quelques questions, localise votre véhicule et cherche un
              professionnel disponible.
            </p>
          </div>
        ) : null}

        {phase === "chat" ? (
          <Section
            title="Assistant TowIA"
            description="Une question à la fois — répondez rapidement."
          >
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "assistant"
                      ? "bg-muted text-foreground"
                      : "ml-auto bg-primary/15 text-primary"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {thinking ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="size-4 animate-pulse text-primary" /> TowIA analyse…
                </div>
              ) : null}
              <div ref={bottomRef} />

              {options.length > 0 && !thinking ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => answer(o)}
                      className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {o}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-2 pt-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") answer(input);
                  }}
                  placeholder="Écrivez votre réponse…"
                  className="rounded-xl"
                  disabled={thinking}
                />
                <Button
                  onClick={() => answer(input)}
                  disabled={thinking || !input.trim()}
                  className="rounded-xl bg-gradient-primary"
                >
                  <Send className="size-4" />
                </Button>
              </div>

              {collected.service_type ? (
                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <span className="rounded-full bg-primary/15 px-3 py-1 font-medium text-primary">
                    {CATEGORY_LABELS[collected.service_type]}
                  </span>
                  <span className={`rounded-full px-3 py-1 font-medium ${urgencyTone}`}>
                    Urgence : {URGENCY_LABELS[collected.urgency]}
                  </span>
                </div>
              ) : null}

              {messages.length > 3 ? (
                <Button
                  variant="secondary"
                  className="mt-2 w-full rounded-xl"
                  onClick={() => setPhase("location")}
                  disabled={!collected.service_type}
                >
                  Passer à la localisation
                </Button>
              ) : null}
            </div>
          </Section>
        ) : null}

        {phase === "location" ? (
          <Section
            title="Puis-je utiliser votre position ?"
            description="Aucune position fictive : partagez la vôtre ou saisissez l'adresse."
          >
            <div className="space-y-4">
              <Button
                onClick={locate}
                variant="secondary"
                className="w-full rounded-xl"
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 size-4" />
                )}
                📍 Utiliser ma position
              </Button>
              {position ? (
                <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                  Position confirmée : {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex : A9 sortie 42, station-service"
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal">Code postal</Label>
                  <Input
                    id="postal"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <Button
                className="w-full rounded-xl bg-gradient-primary"
                disabled={!position && !address}
                onClick={() => setPhase("photos")}
              >
                Continuer
              </Button>
            </div>
          </Section>
        ) : null}

        {phase === "photos" ? (
          <Section
            title="Ajouter des photos"
            description="Jusqu'à 5 photos : véhicule, roue, voyant, dégâts, lieu de panne."
          >
            <div className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void uploadPhotos(e.target.files)}
              />
              <Button
                variant="secondary"
                className="w-full rounded-xl"
                disabled={uploading || photos.length >= MAX_PHOTOS}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 size-4" />
                )}
                Ajouter des photos ({photos.length}/{MAX_PHOTOS})
              </Button>
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative overflow-hidden rounded-xl border border-border">
                      <img src={p.url} alt="Photo de la panne" className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Supprimer la photo"
                        onClick={() => void removePhoto(p)}
                        className="absolute right-1 top-1 rounded-lg bg-background/80 p-1"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <Button
                className="w-full rounded-xl bg-gradient-primary"
                onClick={() => setPhase("recap")}
              >
                Voir le récapitulatif
              </Button>
            </div>
          </Section>
        ) : null}

        {phase === "recap" || phase === "sending" ? (
          <Section title="Récapitulatif de l'assistance" description="Vérifiez avant l'envoi.">
            {!collected.service_type ? (
              <EmptyState title="Type d'intervention manquant" description="Revenez au questionnaire." />
            ) : (
              <div className="space-y-3 text-sm">
                <Row label="Type" value={CATEGORY_LABELS[collected.service_type]} />
                <Row
                  label="Véhicule"
                  value={
                    [collected.vehicle_make, collected.vehicle_model, collected.vehicle_year]
                      .filter(Boolean)
                      .join(" ") || "—"
                  }
                />
                <Row
                  label="Immatriculation"
                  value={collected.vehicle_registration ?? "—"}
                />
                <Row label="Position" value={city || address || "—"} />
                <Row
                  label="Véhicule roulant"
                  value={collected.answers["peut_rouler"] ?? collected.answers["can_drive"] ?? "—"}
                />
                <Row label="Urgence" value={URGENCY_LABELS[collected.urgency]} />
                <Row label="Description" value={collected.problem_description ?? "—"} />
                <Row label="Photos" value={String(photos.length)} />

                <div className="flex flex-col gap-2 pt-3 sm:flex-row">
                  <Button
                    variant="secondary"
                    className="flex-1 rounded-xl"
                    disabled={submitting}
                    onClick={() => setPhase("chat")}
                  >
                    <Pencil className="mr-2 size-4" /> Modifier
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-gradient-primary"
                    disabled={submitting}
                    onClick={() => void confirm()}
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 size-4" />
                    )}
                    Confirmer la demande
                  </Button>
                </div>
                {submitting ? (
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    Recherche d'un professionnel disponible près de vous…
                  </p>
                ) : null}
              </div>
            )}
          </Section>
        ) : null}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
