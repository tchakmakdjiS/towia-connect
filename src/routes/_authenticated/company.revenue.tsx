import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Receipt, PiggyBank } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { Section, StatCard, EmptyState } from "@/components/ui-kit";
import { formatAmount, formatDate } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/company/revenue")({
  head: () => ({
    meta: [
      { title: "Revenus — TowIA" },
      { name: "description", content: "Paiements, commissions et factures de votre entreprise." },
      { property: "og:title", content: "Revenus — TowIA" },
      { property: "og:description", content: "Paiements, commissions et factures." },
    ],
  }),
  component: CompanyRevenue,
});

function CompanyRevenue() {
  const payments = useQuery({
    queryKey: ["company-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ["company-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
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
  const net = paid.reduce((s, p) => s + Number(p.professional_amount ?? 0), 0);

  return (
    <AppShell title="Revenus" subtitle="Paiements et factures" nav={COMPANY_NAV}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Chiffre encaissé" value={formatAmount(gross)} icon={<Wallet className="size-5" />} />
          <StatCard label="Commission plateforme" value={formatAmount(fees)} icon={<Receipt className="size-5" />} />
          <StatCard label="Net professionnel" value={formatAmount(net)} icon={<PiggyBank className="size-5" />} />
        </div>

        <Section title="Paiements">
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

        <Section title="Factures">
          {(invoices.data?.length ?? 0) === 0 ? (
            <EmptyState title="Aucune facture" />
          ) : (
            <ul className="space-y-2">
              {invoices.data!.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm"
                >
                  <span>{i.invoice_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatAmount(Number(i.total), i.currency)} · {i.status}
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
