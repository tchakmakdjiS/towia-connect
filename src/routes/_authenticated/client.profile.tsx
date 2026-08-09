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

export const Route = createFileRoute("/_authenticated/client/profile")({
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

function ClientProfile() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

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
      setFirstName(profile.data.first_name ?? "");
      setLastName(profile.data.last_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

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

  const saveProfile = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq("id", user!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil mis à jour");
  };

  const addVehicle = async () => {
    const { error } = await supabase
      .from("vehicles")
      .insert({ owner_id: user!.id, brand, model, plate });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBrand("");
    setModel("");
    setPlate("");
    void queryClient.invalidateQueries({ queryKey: ["vehicles", user?.id] });
  };

  const removeVehicle = async (id: string) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["vehicles", user?.id] });
  };

  return (
    <AppShell title="Mon profil" subtitle="Informations et véhicules" nav={CLIENT_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Section title="Mes informations">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fn">Prénom</Label>
              <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln">Nom</Label>
              <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ph">Téléphone</Label>
              <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
            </div>
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
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Input placeholder="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-xl" />
            <Input placeholder="Modèle" value={model} onChange={(e) => setModel(e.target.value)} className="rounded-xl" />
            <Input placeholder="Plaque" value={plate} onChange={(e) => setPlate(e.target.value)} className="rounded-xl" />
            <Button
              className="rounded-xl"
              variant="secondary"
              disabled={!brand || !model || !plate}
              onClick={() => void addVehicle()}
            >
              Ajouter
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
