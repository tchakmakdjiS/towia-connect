import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Receipt, PiggyBank } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
import { Section, StatCard, EmptyState } from "@/components/ui-kit";
import { CATEGORY_LABELS, formatAmount, formatDate } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/entreprise/revenue")({
  head: () => ({
    meta: [
      { title: "Paiements et revenus — TowIA" },
      { name: "description", content: "Paiements, commissions et factures de votre entreprise." },
      { property: "og:title", content: "Paiements et revenus — TowIA" },
      { property: "og:description", content: "Paiements, commissions et factures." },
    ],
  }),
  component: CompanyRevenue,
});

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  PAID: "Payé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
  CANCELLED: "Annulé",
};

function CompanyRevenue() {
  const company = useCompany();
  const companyId = company.data?.id;

  const payments = useQuery({
    queryKey: ["company-revenue", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, missions(id, category, city, operators(first_name, last_name, professional_name))")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const clientIds = [...new Set(data.map((p) => p.client_id))];
      const { data: profiles } = clientIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name").in("id", clientIds)
        : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] };
      const names = new Map((profiles ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ")]));
      return data.map((p) => ({ ...p, clientName: names.get(p.client_id) || "Client" }));
    },
  });

  const invoices = useQuery({
    queryKey: ["company-invoices", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", companyId!)
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
    <AppShell title="Paiements" subtitle="Encaissements de vos missions" nav={COMPANY_NAV}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Chiffre encaissé" value={formatAmount(gross)} icon={<Wallet className="size-5" />} />
          <StatCard label="Commission TowIA" value={formatAmount(fees)} icon={<Receipt className="size-5" />} />
          <StatCard label="Net entreprise" value={formatAmount(net)} icon={<PiggyBank className="size-5" />} />
        </div>

        <Section title="Paiements">
          {list.length === 0 ? (
            <EmptyState title="Aucun paiement" />
          ) : (
            <ul className="space-y-2">
              {list.map((p) => {
                const op = p.missions?.operators;
                const opName = op ? op.professional_name || [op.first_name, op.last_name].filter(Boolean).join(" ") : "—";
                return (
                  <li key={p.id} className="rounded-2xl border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          Mission #{p.mission_id.slice(0, 6).toUpperCase()}
                          {p.missions ? ` · ${CATEGORY_LABELS[p.missions.category]}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.paid_at ?? p.created_at)} · Client : {p.clientName} · Dépanneur : {opName}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS_LABEL[p.status] ?? p.status}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>Montant client : <b className="text-foreground">{formatAmount(Number(p.amount), p.currency)}</b></span>
                      <span>Commission TowIA : {formatAmount(Number(p.platform_fee), p.currency)}</span>
                      <span>Net entreprise : <b className="text-foreground">{formatAmount(Number(p.professional_amount), p.currency)}</b></span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Factures">
          {(invoices.data?.length ?? 0) === 0 ? (
            <EmptyState title="Aucune facture" />
          ) : (
            <ul className="space-y-2">
              {invoices.data!.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm">
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
