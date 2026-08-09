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
import { formatDate } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/company/documents")({
  head: () => ({
    meta: [
      { title: "Documents — TowIA" },
      { name: "description", content: "Assurances, licences et documents de conformité." },
      { property: "og:title", content: "Documents — TowIA" },
      { property: "og:description", content: "Assurances, licences et conformité." },
    ],
  }),
  component: CompanyDocuments,
});

function CompanyDocuments() {
  const company = useCompany();
  const companyId = company.data?.id;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const documents = useQuery({
    queryKey: ["company-documents", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    const { error } = await supabase.from("documents").insert({
      company_id: companyId!,
      name,
      type: type || null,
      file_url: fileUrl || null,
      expires_at: expiresAt || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setType("");
    setFileUrl("");
    setExpiresAt("");
    void queryClient.invalidateQueries({ queryKey: ["company-documents", companyId] });
  };

  return (
    <AppShell title="Documents" subtitle="Conformité" nav={COMPANY_NAV}>
      <Section title="Mes documents" description="Statut de vérification géré par l'administration TowIA.">
        {(documents.data?.length ?? 0) === 0 ? (
          <EmptyState title="Aucun document" />
        ) : (
          <ul className="space-y-2">
            {documents.data!.map((d) => (
              <li key={d.id} className="rounded-2xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">{d.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.type ?? "—"} · expire le {formatDate(d.expires_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          <Input placeholder="Type" value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl" />
          <Input placeholder="Lien du fichier" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className="rounded-xl" />
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-xl" />
          <Button variant="secondary" className="rounded-xl" disabled={!companyId || !name} onClick={() => void add()}>
            Ajouter
          </Button>
        </div>
      </Section>
    </AppShell>
  );
}
