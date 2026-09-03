import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MISSION_CATEGORIES, type MissionCategory } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/depanneur/profil")({
  head: () => ({
    meta: [
      { title: "Profil dépanneur — TowIA" },
      { name: "description", content: "Vos services, votre rayon d'intervention et votre position." },
      { property: "og:title", content: "Profil dépanneur — TowIA" },
      { property: "og:description", content: "Services et rayon d'intervention." },
    ],
  }),
  component: OperatorProfile,
});

const VEHICLE_TYPES = [
  "Véhicule léger",
  "4x4 panier",
  "Plateau",
  "Véhicule surbaissé",
  "Patrouilleur",
  "Véhicule bâché",
];

const AVAILABILITY = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "UNAVAILABLE", label: "Indisponible" },
  { value: "ON_MISSION", label: "En intervention" },
] as const;

type Availability = (typeof AVAILABILITY)[number]["value"];

function OperatorProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [services, setServices] = useState<MissionCategory[]>([]);
  const [availability, setAvailability] = useState<Availability>("UNAVAILABLE");
  const [vehicleType, setVehicleType] = useState<string>(VEHICLE_TYPES[0]!);
  const [radius, setRadius] = useState("30");
  const [available247, setAvailable247] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    company_name: "",
    siret: "",
    address: "",
    city: "",
    postal_code: "",
    intervention_zone: "",
  });

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

  useEffect(() => {
    const d = operator.data;
    if (!d) return;
    setForm({
      first_name: d.first_name ?? "",
      last_name: d.last_name ?? "",
      phone: d.phone ?? "",
      email: d.email ?? user?.email ?? "",
      company_name: d.company_name ?? "",
      siret: d.siret ?? "",
      address: d.address ?? "",
      city: d.city ?? "",
      postal_code: d.postal_code ?? "",
      intervention_zone: d.intervention_zone ?? "",
    });
    setServices((d.services ?? []) as MissionCategory[]);
    setAvailability((d.availability ?? "UNAVAILABLE") as Availability);
    setVehicleType(d.vehicle_type ?? VEHICLE_TYPES[0]!);
    setRadius(String(d.service_radius_km ?? 30));
    setAvailable247(!!d.available_24_7);
  }, [operator.data, user?.email]);

  const save = async () => {
    if (!user) return;
    const payload = {
      ...form,
      user_id: user.id,
      services,
      availability,
      vehicle_type: vehicleType,
      service_radius_km: Number(radius) || 0,
      available_24_7: available247,
      is_available: availability === "AVAILABLE",
    };
    const { error } = operator.data
      ? await supabase.from("operators").update(payload).eq("id", operator.data.id)
      : await supabase.from("operators").insert(payload);
    if (error) {
      toast.error("Enregistrement impossible. Veuillez réessayer.");
      return;
    }
    toast.success("Profil professionnel enregistré");
    void queryClient.invalidateQueries({ queryKey: ["operator", user.id] });
  };

  const shareLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation || !operator.data) {
      toast.error("Position indisponible ou profil incomplet.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { error } = await supabase
        .from("operators")
        .update({
          last_latitude: pos.coords.latitude,
          last_longitude: pos.coords.longitude,
        })
        .eq("id", operator.data!.id);
      if (error) {
        toast.error("Mise à jour de la position impossible.");
        return;
      }
      toast.success("Position mise à jour");
    });
  };

  const toggleService = (value: MissionCategory) => {
    setServices((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  };

  const field = (key: keyof typeof form, label: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key]}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        className="rounded-xl"
      />
    </div>
  );

  return (
    <AppShell title="Mon profil professionnel" subtitle="Coordonnées, services et zone" nav={OPERATOR_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Section title="Mes coordonnées">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("first_name", "Prénom")}
            {field("last_name", "Nom")}
            {field("phone", "Téléphone")}
            {field("email", "Email")}
            {field("company_name", "Nom de l'entreprise")}
            {field("siret", "SIRET")}
            <div className="sm:col-span-2">{field("address", "Adresse")}</div>
            {field("city", "Ville")}
            {field("postal_code", "Code postal")}
          </div>
        </Section>

        <Section title="Véhicule d'intervention">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VEHICLE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setVehicleType(t)}
                className={`rounded-xl border p-3 text-xs font-medium ${
                  vehicleType === t
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Services proposés">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MISSION_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleService(c.value)}
                className={`rounded-xl border p-3 text-xs font-medium ${
                  services.includes(c.value)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Zone d'intervention">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="radius">Rayon d'intervention (km)</Label>
              <Input
                id="radius"
                type="number"
                min={1}
                max={500}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="rounded-xl"
              />
            </div>
            {field("intervention_zone", "Zone couverte")}
          </div>
        </Section>

        <Section title="Disponibilité">
          <div className="grid grid-cols-3 gap-2">
            {AVAILABILITY.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAvailability(a.value)}
                className={`rounded-xl border p-3 text-xs font-medium ${
                  availability === a.value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAvailable247((v) => !v)}
            className={`mt-3 w-full rounded-xl border p-3 text-xs font-medium ${
              available247
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            Disponible 24h/24 · 7j/7 {available247 ? "✓" : ""}
          </button>
          <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={() => void save()}>
            Enregistrer mon profil
          </Button>
        </Section>

        <Section
          title="Position actuelle"
          description="Partagez votre position réelle pour recevoir les missions proches."
        >
          <Button variant="secondary" className="rounded-xl" onClick={shareLocation}>
            Mettre à jour ma position
          </Button>
        </Section>
      </div>
    </AppShell>
  );
}
