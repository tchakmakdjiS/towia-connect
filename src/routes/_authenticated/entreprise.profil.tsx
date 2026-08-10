import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
import { Section } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/entreprise/profil")({
  head: () => ({
    meta: [
      { title: "Profil entreprise — TowIA" },
      { name: "description", content: "Informations légales et zone d'intervention de votre entreprise." },
      { property: "og:title", content: "Profil entreprise — TowIA" },
      { property: "og:description", content: "Informations légales et zone d'intervention." },
    ],
  }),
  component: CompanyProfile,
});

function CompanyProfile() {
  const { user } = useAuth();
  const company = useCompany();
  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    siret: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    manager_name: "",
    intervention_zone: "",
  });

  useEffect(() => {
    if (company.data) {
      setForm({
        name: company.data.name ?? "",
        legal_name: company.data.legal_name ?? "",
        siret: company.data.siret ?? "",
        email: company.data.email ?? "",
        phone: company.data.phone ?? "",
        address: company.data.address ?? "",
        city: company.data.city ?? "",
        postal_code: company.data.postal_code ?? "",
        manager_name: company.data.manager_name ?? "",
        intervention_zone: company.data.intervention_zone ?? "",
      });
    }
  }, [company.data]);

  const operatorsCount = useQuery({
    queryKey: ["company-operators-count", company.data?.id],
    enabled: !!company.data?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("operators")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.data!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const save = async () => {
    if (!user) return;
    const payload = { ...form, owner_id: user.id };
    const { error } = company.data
      ? await supabase.from("companies").update(payload).eq("id", company.data.id)
      : await supabase.from("companies").insert(payload);
    if (error) {
      toast.error("Enregistrement impossible. Veuillez réessayer.");
      return;
    }
    toast.success("Profil entreprise enregistré");
    void company.refetch();
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
    <AppShell title="Profil entreprise" subtitle="Informations légales" nav={COMPANY_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Section
          title="Informations"
          description={`Statut de vérification : ${company.data?.verification ?? "non soumis"}`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", "Nom commercial")}
            {field("legal_name", "Raison sociale")}
            {field("siret", "SIRET")}
            {field("manager_name", "Nom du responsable")}
            {field("email", "Email")}
            {field("phone", "Téléphone")}
            <div className="sm:col-span-2">{field("address", "Adresse")}</div>
            {field("city", "Ville")}
            {field("postal_code", "Code postal")}
            <div className="sm:col-span-2">{field("intervention_zone", "Zone d'intervention")}</div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Dépanneurs rattachés : {operatorsCount.data ?? 0}
          </p>
          <Button className="mt-4 rounded-xl bg-gradient-primary" onClick={() => void save()}>
            Enregistrer
          </Button>

        </Section>
      </div>
    </AppShell>
  );
}
