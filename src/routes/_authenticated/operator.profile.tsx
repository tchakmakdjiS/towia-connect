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

export const Route = createFileRoute("/_authenticated/operator/profile")({
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

function OperatorProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [zone, setZone] = useState("");
  const [services, setServices] = useState<MissionCategory[]>([]);

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
    if (operator.data) {
      setZone(operator.data.intervention_zone ?? "");
      setServices((operator.data.services ?? []) as MissionCategory[]);
    }
  }, [operator.data]);

  const save = async () => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      intervention_zone: zone || null,
      services,
    };
    const { error } = operator.data
      ? await supabase.from("operators").update(payload).eq("id", operator.data.id)
      : await supabase.from("operators").insert(payload);
    if (error) {
      toast.error(error.message);
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
        toast.error(error.message);
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

  return (
    <AppShell title="Mon profil professionnel" subtitle="Services et zone" nav={OPERATOR_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
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
          <div className="space-y-2">
            <Label htmlFor="zone">Zone couverte</Label>
            <Input
              id="zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Ex : Lyon et périphérie"
              className="rounded-xl"
            />
          </div>
          <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={() => void save()}>
            Enregistrer
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
