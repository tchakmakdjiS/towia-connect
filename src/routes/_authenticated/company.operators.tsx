import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/company/operators")({
  head: () => ({
    meta: [
      { title: "Équipe — TowIA" },
      { name: "description", content: "Gérez les dépanneurs rattachés à votre entreprise." },
      { property: "og:title", content: "Équipe — TowIA" },
      { property: "og:description", content: "Gérez les dépanneurs de votre entreprise." },
    ],
  }),
  component: CompanyOperators,
});

function CompanyOperators() {
  const company = useCompany();
  const companyId = company.data?.id;
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const operators = useQuery({
    queryKey: ["company-operators-all", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    const { error } = await supabase.from("operators").insert({
      company_id: companyId!,
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setFirstName("");
    setLastName("");
    setPhone("");
    void queryClient.invalidateQueries({ queryKey: ["company-operators-all", companyId] });
  };

  return (
    <AppShell title="Équipe" subtitle="Dépanneurs rattachés" nav={COMPANY_NAV}>
      <Section title="Mes dépanneurs">
        {(operators.data?.length ?? 0) === 0 ? (
          <EmptyState title="Aucun dépanneur" description="Ajoutez les membres de votre équipe." />
        ) : (
          <ul className="space-y-2">
            {operators.data!.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm"
              >
                <span>
                  {o.first_name} {o.last_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {o.is_available ? "Disponible" : "Indisponible"} · {o.verification}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Input placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded-xl" />
          <Input placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded-xl" />
          <Input placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
          <Button
            variant="secondary"
            className="rounded-xl"
            disabled={!companyId || !firstName || !lastName}
            onClick={() => void add()}
          >
            Ajouter
          </Button>
        </div>
      </Section>
    </AppShell>
  );
}
