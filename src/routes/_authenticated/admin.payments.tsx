import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState, StatCard } from "@/components/ui-kit";
import { formatAmount, formatDate } from "@/lib/towia";
import { Wallet, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Paiements — Administration TowIA" },
      { name: "description", content: "Suivi des paiements et commissions de la plateforme." },
      { property: "og:title", content: "Paiements — Administration TowIA" },
      { property: "og:description", content: "Suivi des paiements et commissions." },
    ],
  }),
  component: AdminPayments,
});

function AdminPayments() {
  const payments = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = payments.data ?? [];
  const paid = list.filter((p) => p.status === "PAID");
  const gross = paid.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const fees = paid.reduce((s, p) => s + Number(p.platform_fee ?? 0), 0);

  return (
    <AppShell title="Paiements" subtitle="Flux financiers" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Volume encaissé" value={formatAmount(gross)} icon={<Wallet className="size-5" />} />
          <StatCard label="Commissions" value={formatAmount(fees)} icon={<Receipt className="size-5" />} />
        </div>
        <Section title="Transactions">
          {list.length === 0 ? (
            <EmptyState title="Aucun paiement" />
          ) : (
            <ul className="space-y-2">
              {list.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm"
                >
                  <span>{formatAmount(Number(p.amount), p.currency)}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.status} · {formatDate(p.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
