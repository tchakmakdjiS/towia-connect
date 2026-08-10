import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/entreprise/vehicles")({
  head: () => ({
    meta: [
      { title: "Flotte — TowIA" },
      { name: "description", content: "Gérez les véhicules de dépannage de votre entreprise." },
      { property: "og:title", content: "Flotte — TowIA" },
      { property: "og:description", content: "Gérez les véhicules de votre entreprise." },
    ],
  }),
  component: CompanyVehicles,
});

function CompanyVehicles() {
  const company = useCompany();
  const companyId = company.data?.id;
  const queryClient = useQueryClient();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");

  const vehicles = useQuery({
    queryKey: ["company-vehicles-all", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    const { error } = await supabase
      .from("vehicles")
      .insert({ company_id: companyId!, brand, model, plate });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBrand("");
    setModel("");
    setPlate("");
    void queryClient.invalidateQueries({ queryKey: ["company-vehicles-all", companyId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["company-vehicles-all", companyId] });
  };

  return (
    <AppShell title="Flotte" subtitle="Véhicules de dépannage" nav={COMPANY_NAV}>
      <Section title="Mes véhicules">
        {(vehicles.data?.length ?? 0) === 0 ? (
          <EmptyState title="Aucun véhicule" />
        ) : (
          <ul className="space-y-2">
            {vehicles.data!.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm"
              >
                <span>
                  {v.brand} {v.model} — {v.plate}
                </span>
                <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => void remove(v.id)}>
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
            variant="secondary"
            className="rounded-xl"
            disabled={!companyId || !brand || !model || !plate}
            onClick={() => void add()}
          >
            Ajouter
          </Button>
        </div>
      </Section>
    </AppShell>
  );
}
