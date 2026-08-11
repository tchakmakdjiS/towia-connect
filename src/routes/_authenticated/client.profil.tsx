import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/client/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — TowIA" },
      { name: "description", content: "Gérez vos informations et vos véhicules TowIA." },
      { property: "og:title", content: "Mon profil — TowIA" },
      { property: "og:description", content: "Gérez vos informations et vos véhicules." },
    ],
  }),
  component: ClientProfile,
});

const VEHICLE_TYPES = ["Citadine", "Berline", "SUV / 4x4", "Utilitaire", "Moto", "Camping-car", "Autre"];

function ClientProfile() {
  const { user, refresh, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    postal_code: "",
  });

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        first_name: profile.data.first_name ?? "",
        last_name: profile.data.last_name ?? "",
        phone: profile.data.phone ?? "",
        email: profile.data.email ?? user?.email ?? "",
        address: profile.data.address ?? "",
        city: profile.data.city ?? "",
        postal_code: profile.data.postal_code ?? "",
      });
    }
  }, [profile.data, user?.email]);

  const vehicles = useQuery({
    queryKey: ["vehicles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("owner_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[0]!);

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    if (error) {
      toast.error("Enregistrement impossible. Veuillez réessayer.");
      return;
    }
    toast.success("Profil mis à jour");
    void profile.refetch();
    void refresh();
  };

  const addVehicle = async () => {
    const { error } = await supabase
      .from("vehicles")
      .insert({ owner_id: user!.id, brand, model, plate, color, vehicle_type: vehicleType });
    if (error) {
      toast.error("Ajout du véhicule impossible.");
      return;
    }
    setBrand("");
    setModel("");
    setPlate("");
    setColor("");
    void queryClient.invalidateQueries({ queryKey: ["vehicles", user?.id] });
  };

  const removeVehicle = async (id: string) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["vehicles", user?.id] });
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
    <AppShell title="Mon profil" subtitle="Informations et véhicules" nav={CLIENT_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Section title="Mes informations">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("first_name", "Prénom")}
            {field("last_name", "Nom")}
            {field("phone", "Téléphone")}
            {field("email", "Email")}
            <div className="sm:col-span-2">{field("address", "Adresse")}</div>
            {field("city", "Ville")}
            {field("postal_code", "Code postal")}
          </div>

          <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={() => void saveProfile()}>
            Enregistrer
          </Button>
        </Section>

        <Section title="Mes véhicules">
          {(vehicles.data?.length ?? 0) === 0 ? (
            <EmptyState title="Aucun véhicule enregistré" />
          ) : (
            <ul className="space-y-2">
              {vehicles.data!.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm"
                >
                  <span>
                    {v.brand} {v.model} — {v.plate}
                    {v.vehicle_type ? ` · ${v.vehicle_type}` : ""}
                    {v.color ? ` · ${v.color}` : ""}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Supprimer"
                    onClick={() => void removeVehicle(v.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input placeholder="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-xl" />
            <Input placeholder="Modèle" value={model} onChange={(e) => setModel(e.target.value)} className="rounded-xl" />
            <Input placeholder="Immatriculation" value={plate} onChange={(e) => setPlate(e.target.value)} className="rounded-xl" />
            <select
              aria-label="Type de véhicule"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t} className="bg-card">
                  {t}
                </option>
              ))}
            </select>
            <Button
              className="rounded-xl sm:col-span-2"
              variant="secondary"
              disabled={!brand || !model || !plate}
              onClick={() => void addVehicle()}
            >
              Ajouter le véhicule
            </Button>
          </div>

        </Section>

        <Button variant="secondary" className="rounded-xl" onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </AppShell>
  );
}
