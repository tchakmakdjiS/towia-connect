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

export const Route = createFileRoute("/_authenticated/company/equipment")({
  head: () => ({
    meta: [
      { title: "Équipements — TowIA" },
      { name: "description", content: "Inventaire des équipements de votre entreprise de dépannage." },
      { property: "og:title", content: "Équipements — TowIA" },
      { property: "og:description", content: "Inventaire des équipements de dépannage." },
    ],
  }),
  component: CompanyEquipment,
});

function CompanyEquipment() {
  const company = useCompany();
  const companyId = company.data?.id;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");

  const equipment = useQuery({
    queryKey: ["company-equipment", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    const { error } = await supabase.from("equipment").insert({
      company_id: companyId!,
      name,
      category: category || null,
      quantity: Number(quantity) || 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setCategory("");
    setQuantity("1");
    void queryClient.invalidateQueries({ queryKey: ["company-equipment", companyId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("equipment").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["company-equipment", companyId] });
  };

  return (
    <AppShell title="Équipements" subtitle="Inventaire" nav={COMPANY_NAV}>
      <Section title="Mon matériel">
        {(equipment.data?.length ?? 0) === 0 ? (
          <EmptyState title="Aucun équipement enregistré" />
        ) : (
          <ul className="space-y-2">
            {equipment.data!.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm"
              >
                <span>
                  {e.name} {e.category ? `· ${e.category}` : ""} — x{e.quantity}
                </span>
                <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => void remove(e.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          <Input placeholder="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl" />
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="rounded-xl" />
          <Button variant="secondary" className="rounded-xl" disabled={!companyId || !name} onClick={() => void add()}>
            Ajouter
          </Button>
        </div>
      </Section>
    </AppShell>
  );
}
