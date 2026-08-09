import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Send, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MISSION_CATEGORIES,
  MISSION_PRIORITY_LABELS,
  type MissionCategory,
  type MissionPriority,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/client/sos")({
  head: () => ({
    meta: [
      { title: "SOS assistance — TowIA" },
      {
        name: "description",
        content: "Lancez une demande d'assistance TowIA : localisation, analyse et dispatch.",
      },
      { property: "og:title", content: "SOS assistance — TowIA" },
      { property: "og:description", content: "Demande d'assistance en quelques secondes." },
    ],
  }),
  component: SosPage,
});

type Position = { latitude: number; longitude: number } | null;

function SosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [position, setPosition] = useState<Position>(null);
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [category, setCategory] = useState<MissionCategory | null>(null);
  const [priority, setPriority] = useState<MissionPriority>("NORMAL");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
        toast.success("Position détectée");
      },
      () => {
        setLocating(false);
        toast.error("Position non partagée. Vous pouvez saisir une adresse manuellement.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async () => {
    if (!user || !category) return;
    setSubmitting(true);

    const { data: mission, error } = await supabase
      .from("missions")
      .insert({
        client_id: user.id,
        category,
        priority,
        description: description || null,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        address: address || null,
        photo_url: photoUrl || null,
        status: "AI_ANALYSIS",
      })
      .select()
      .single();

    if (error || !mission) {
      setSubmitting(false);
      toast.error(error?.message ?? "Création impossible");
      return;
    }

    await supabase.from("ai_conversations").insert({
      user_id: user.id,
      mission_id: mission.id,
      messages: [
        { role: "assistant", content: "Que se passe-t-il ?" },
        { role: "user", content: description || category },
      ],
    });

    await supabase.from("mission_ai_analysis").insert({
      mission_id: mission.id,
      category,
      priority,
      needs: [],
      summary_for_operator: description || null,
    });

    await supabase.from("missions").update({ status: "SEARCHING" }).eq("id", mission.id);

    await supabase.from("notifications").insert({
      user_id: user.id,
      mission_id: mission.id,
      event: "MISSION_CREATED",
      title: "Demande d'assistance envoyée",
      body: "TowIA recherche un professionnel disponible.",
    });

    setSubmitting(false);
    toast.success("Demande envoyée");
    void navigate({ to: "/client/mission/$id", params: { id: mission.id } });
  };

  return (
    <AppShell title="SOS assistance" subtitle="Étape " + nav={CLIENT_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Section
          title="Étape 1 — Votre position"
          description="TowIA n'utilise aucune position fictive : partagez ou saisissez la vôtre."
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
              Partager ma position
            </Button>
            {position ? (
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                Position confirmée : {position.latitude.toFixed(5)},{" "}
                {position.longitude.toFixed(5)}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="address">Adresse ou point de repère</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex : A7 sortie 12, station-service"
                className="rounded-xl"
              />
            </div>
            {step === 1 ? (
              <Button
                className="w-full rounded-xl bg-gradient-primary"
                disabled={!position && !address}
                onClick={() => setStep(2)}
              >
                Continuer
              </Button>
            ) : null}
          </div>
        </Section>

        {step === 2 ? (
          <Section
            title="Étape 2 — Que se passe-t-il ?"
            description="Choisissez une catégorie, décrivez librement et ajoutez une photo."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MISSION_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`rounded-xl border p-3 text-xs font-medium transition-colors ${
                      category === c.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Décrivez la situation à TowIA</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Le véhicule ne démarre plus, voyant batterie allumé..."
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">
                  <Camera className="mr-1 inline size-4" /> Lien d'une photo (optionnel)
                </Label>
                <Input
                  id="photo"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Priorité</Label>
                <div className="flex gap-2">
                  {(Object.keys(MISSION_PRIORITY_LABELS) as MissionPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium ${
                        priority === p
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {MISSION_PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                TowIA ne communique jamais de prix, de disponibilité ou de diagnostic certain
                avant qu'un professionnel réel ne prenne la mission.
              </p>

              <Button
                onClick={() => void submit()}
                disabled={!category || submitting}
                className="w-full rounded-xl bg-gradient-primary"
              >
                {submitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Send className="mr-2 size-4" />
                )}
                Envoyer ma demande
              </Button>
            </div>
          </Section>
        ) : null}
      </div>
    </AppShell>
  );
}
