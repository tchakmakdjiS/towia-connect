import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CLIENT_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { PriceEstimate } from "@/components/PriceEstimate";
import { getMissionQuote, createMissionCheckout, confirmTestPayment } from "@/lib/payments.functions";
import { CATEGORY_LABELS } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/client/paiement/$id")({
  head: () => ({
    meta: [
      { title: "Paiement de l'intervention — TowIA" },
      { name: "description", content: "Détail du prix et paiement sécurisé de votre intervention TowIA." },
      { property: "og:title", content: "Paiement de l'intervention — TowIA" },
      { property: "og:description", content: "Détail du prix et paiement sécurisé." },
    ],
  }),
  component: ClientPayment,
});

function ClientPayment() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const quoteFn = useServerFn(getMissionQuote);
  const checkoutFn = useServerFn(createMissionCheckout);
  const testFn = useServerFn(confirmTestPayment);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [testPaymentId, setTestPaymentId] = useState<string | null>(null);

  const mission = useQuery({
    queryKey: ["mission", id],
    queryFn: async () => {
      const { data } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const quote = useQuery({
    queryKey: ["mission-quote", id],
    queryFn: () => quoteFn({ data: { missionId: id } }),
  });

  const payment = useQuery({
    queryKey: ["mission-payment", id],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("mission_id", id).maybeSingle();
      return data;
    },
  });

  const start = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const result = await checkoutFn({
        data: { missionId: id, returnUrl: window.location.origin },
      });
      if (result.mode === "stripe") {
        window.location.href = result.url;
        return;
      }
      if (result.mode === "paid") {
        toast.success("Cette mission est déjà payée.");
        void navigate({ to: "/client/mission/$id", params: { id } });
        return;
      }
      setTestPaymentId(result.paymentId);
      toast.message("Mode test — aucun paiement réel ne sera effectué.");
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Le paiement n'a pas pu être effectué.");
    } finally {
      setBusy(false);
    }
  };

  const finishTest = async (outcome: "paid" | "failed") => {
    if (!testPaymentId) return;
    setBusy(true);
    try {
      const result = await testFn({ data: { paymentId: testPaymentId, outcome } });
      if (result.ok) {
        toast.success("Paiement de test confirmé");
        void navigate({ to: "/client/mission/$id", params: { id } });
      } else {
        setFailed("Le paiement n'a pas pu être effectué.");
      }
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Le paiement n'a pas pu être effectué.");
    } finally {
      setBusy(false);
      void payment.refetch();
    }
  };

  const m = mission.data;
  const breakdown = quote.data?.breakdown ?? null;
  const testMode = quote.data?.testMode ?? true;

  return (
    <AppShell title="Paiement" subtitle="Confirmation et règlement" nav={CLIENT_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        {!m ? (
          <EmptyState title="Mission introuvable" />
        ) : payment.data?.status === "PAID" ? (
          <Section title="Paiement confirmé">
            <p className="text-sm text-muted-foreground">
              Cette intervention est réglée{payment.data.is_test ? " (mode test)" : ""}.
            </p>
            <Button
              className="mt-4 rounded-xl bg-gradient-primary"
              onClick={() => void navigate({ to: "/client/paiements" })}
            >
              Voir ma facture
            </Button>
          </Section>
        ) : (
          <Section
            title={`Intervention — ${CATEGORY_LABELS[m.category]}`}
            description="Vérifiez le détail avant de payer."
          >
            {quote.isLoading ? (
              <p className="text-sm text-muted-foreground">Calcul du prix…</p>
            ) : !breakdown ? (
              <EmptyState
                title="Tarif indisponible"
                description="Aucun tarif actif n'est configuré pour ce service."
              />
            ) : (
              <div className="space-y-4">
                <PriceEstimate breakdown={breakdown} testMode={testMode} />

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    J'accepte le prix estimé et les conditions d'intervention TowIA.
                  </span>
                </label>

                {failed ? (
                  <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                    <p className="text-sm font-medium text-destructive">{failed}</p>
                    <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => void start()}>
                      Réessayer
                    </Button>
                  </div>
                ) : null}

                {testPaymentId ? (
                  <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
                    <p className="text-sm font-medium text-warning">
                      Mode test — aucun paiement réel. Simulez le résultat du parcours :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl bg-gradient-primary"
                        disabled={busy}
                        onClick={() => void finishTest("paid")}
                      >
                        Paiement accepté (test)
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        disabled={busy}
                        onClick={() => void finishTest("failed")}
                      >
                        Paiement refusé (test)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full rounded-xl bg-gradient-primary"
                    disabled={busy || !accepted}
                    onClick={() => void start()}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 size-4" />
                    )}
                    Confirmer et payer
                  </Button>
                )}

                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4" /> Paiement traité côté serveur. Aucune donnée de
                  carte n'est stockée par TowIA.
                </p>
              </div>
            )}
          </Section>
        )}
      </div>
    </AppShell>
  );
}
