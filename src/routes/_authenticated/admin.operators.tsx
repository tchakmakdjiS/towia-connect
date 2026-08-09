import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/operators")({
  head: () => ({
    meta: [
      { title: "Professionnels — Administration TowIA" },
      { name: "description", content: "Validation et suivi des dépanneurs de la plateforme." },
      { property: "og:title", content: "Professionnels — Administration TowIA" },
      { property: "og:description", content: "Validation et suivi des dépanneurs." },
    ],
  }),
  component: AdminOperators,
});

function AdminOperators() {
  const queryClient = useQueryClient();

  const operators = useQuery({
    queryKey: ["admin-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setVerification = async (id: string, verification: "VERIFIED" | "REJECTED" | "PENDING") => {
    const { error } = await supabase.from("operators").update({ verification }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["admin-operators"] });
  };

  const list = operators.data ?? [];

  return (
    <AppShell title="Professionnels" subtitle="Vérification des dépanneurs" nav={ADMIN_NAV}>
      <Section title="Dépanneurs">
        {list.length === 0 ? (
          <EmptyState title="Aucun professionnel" />
        ) : (
          <ul className="space-y-2">
            {list.map((o) => (
              <li key={o.id} className="rounded-2xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {o.first_name ?? "—"} {o.last_name ?? ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{o.verification}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => void setVerification(o.id, "VERIFIED")}>
                    Valider
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => void setVerification(o.id, "REJECTED")}>
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
