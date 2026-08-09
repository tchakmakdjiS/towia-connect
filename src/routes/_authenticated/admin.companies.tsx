import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  head: () => ({
    meta: [
      { title: "Entreprises — Administration TowIA" },
      { name: "description", content: "Validation des entreprises de dépannage TowIA." },
      { property: "og:title", content: "Entreprises — Administration TowIA" },
      { property: "og:description", content: "Validation des entreprises de dépannage." },
    ],
  }),
  component: AdminCompanies,
});

function AdminCompanies() {
  const queryClient = useQueryClient();

  const companies = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setVerification = async (id: string, verification: "VERIFIED" | "REJECTED" | "PENDING") => {
    const { error } = await supabase.from("companies").update({ verification }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
  };

  const list = companies.data ?? [];

  return (
    <AppShell title="Entreprises" subtitle="Vérification" nav={ADMIN_NAV}>
      <Section title="Entreprises inscrites">
        {list.length === 0 ? (
          <EmptyState title="Aucune entreprise" />
        ) : (
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="rounded-2xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.verification}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.legal_name ?? "—"} · SIRET {c.siret ?? "—"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => void setVerification(c.id, "VERIFIED")}>
                    Valider
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => void setVerification(c.id, "REJECTED")}>
                    Rejeter
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
