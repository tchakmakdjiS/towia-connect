import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, Receipt, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount, formatDate } from "@/lib/towia";
import { PAYMENT_STATUS_LABELS } from "@/lib/pricing";
import { refundPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Paiements — Administration TowIA" },
      { name: "description", content: "Suivi des paiements, commissions et remboursements de la plateforme." },
      { property: "og:title", content: "Paiements — Administration TowIA" },
      { property: "og:description", content: "Suivi des paiements et commissions." },
    ],
  }),
  component: AdminPayments,
});

function AdminPayments() {
  const queryClient = useQueryClient();
  const refundFn = useServerFn(refundPayment);
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

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
  const refunded = list
    .filter((p) => p.status === "REFUNDED")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const submitRefund = async (paymentId: string) => {
    setBusy(true);
    try {
      await refundFn({ data: { paymentId, amount: Number(amount), reason } });
      toast.success("Remboursement enregistré");
      setOpenId(null);
      setAmount("");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Remboursement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Paiements" subtitle="Flux financiers" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Volume encaissé" value={formatAmount(gross)} icon={<Wallet className="size-5" />} />
          <StatCard label="Commissions" value={formatAmount(fees)} icon={<Receipt className="size-5" />} />
          <StatCard label="Remboursé" value={formatAmount(refunded)} icon={<Undo2 className="size-5" />} />
        </div>
        <Section title="Transactions">
          {list.length === 0 ? (
            <EmptyState title="Aucun paiement" />
          ) : (
            <ul className="space-y-2">
              {list.map((p) => (
                <li key={p.id} className="rounded-2xl border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{formatAmount(Number(p.amount), p.currency)}</span>
                    <span className="text-xs text-muted-foreground">
                      {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      {p.is_test ? " · test" : ""} · {formatDate(p.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Commission {formatAmount(Number(p.platform_fee ?? 0), p.currency)} · Professionnel{" "}
                    {formatAmount(Number(p.professional_amount ?? 0), p.currency)}
                  </p>
                  {p.status === "PAID" ? (
                    openId === p.id ? (
                      <div className="mt-3 space-y-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          placeholder="Montant à rembourser"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="rounded-xl"
                        />
                        <Input
                          placeholder="Motif"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="rounded-xl"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-xl bg-gradient-primary"
                            disabled={busy || !amount}
                            onClick={() => void submitRefund(p.id)}
                          >
                            Rembourser
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="rounded-xl"
                            onClick={() => setOpenId(null)}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3 rounded-xl"
                        onClick={() => {
                          setOpenId(p.id);
                          setAmount(String(p.amount ?? ""));
                        }}
                      >
                        <Undo2 className="mr-2 size-4" /> Rembourser
                      </Button>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
