import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { CATEGORY_LABELS, formatAmount, formatDate } from "@/lib/towia";
import { PAYMENT_STATUS_LABELS } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/client/paiements")({
  head: () => ({
    meta: [
      { title: "Mes paiements — TowIA" },
      { name: "description", content: "Historique de vos paiements et factures d'assistance TowIA." },
      { property: "og:title", content: "Mes paiements — TowIA" },
      { property: "og:description", content: "Historique de vos paiements et factures." },
    ],
  }),
  component: ClientPayments,
});

function ClientPayments() {
  const { user } = useAuth();

  const payments = useQuery({
    queryKey: ["client-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, missions(category, created_at)")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ["client-invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").eq("client_id", user!.id);
      return data ?? [];
    },
  });

  const rows = payments.data ?? [];

  return (
    <AppShell title="Mes paiements" subtitle="Historique et factures" nav={CLIENT_NAV}>
      <Section title="Paiements">
        {rows.length === 0 ? (
          <EmptyState title="Aucun paiement" description="Vos règlements apparaîtront ici." />
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => {
              const invoice = (invoices.data ?? []).find((i) => i.payment_id === p.id);
              const mission = p.missions as { category: string } | null;
              return (
                <li key={p.id} className="rounded-2xl border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {mission ? CATEGORY_LABELS[mission.category as never] : "Intervention"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatAmount(Number(p.amount), p.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                        {p.is_test ? " · mode test" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <Link
                      to="/client/mission/$id"
                      params={{ id: p.mission_id }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Voir la mission
                    </Link>
                    {p.status === "PAID" && invoice ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Receipt className="size-3.5" /> Facture {invoice.invoice_number}
                      </span>
                    ) : p.status !== "PAID" ? (
                      <Link
                        to="/client/paiement/$id"
                        params={{ id: p.mission_id }}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Régler
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
