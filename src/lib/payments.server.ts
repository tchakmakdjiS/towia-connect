/** Logique serveur partagée pour la confirmation de paiement (server fns + webhook Stripe). */
import { round2 } from "@/lib/pricing-core";

export async function markPaid(supabase: any, payment: any) {
  const paidAt = new Date().toISOString();
  await supabase.from("payments").update({ status: "PAID", paid_at: paidAt }).eq("id", payment.id);
  await supabase
    .from("missions")
    .update({ payment_status: "paid", amount: payment.amount })
    .eq("id", payment.mission_id);

  await supabase.from("mission_events").insert({
    mission_id: payment.mission_id,
    label: "payment_completed",
    actor_id: payment.client_id,
    metadata: { payment_id: payment.id, amount: payment.amount, is_test: payment.is_test },
  });

  const { data: invoiceExisting } = await supabase
    .from("invoices")
    .select("id")
    .eq("mission_id", payment.mission_id)
    .maybeSingle();
  if (!invoiceExisting) {
    const total = Number(payment.amount ?? 0);
    const subtotal = round2(total / 1.2);
    await supabase.from("invoices").insert({
      mission_id: payment.mission_id,
      payment_id: payment.id,
      invoice_number: `TOWIA-${new Date().getFullYear()}-${payment.id.slice(0, 8).toUpperCase()}`,
      client_id: payment.client_id,
      operator_id: payment.operator_id,
      company_id: payment.company_id,
      subtotal,
      tax_amount: round2(total - subtotal),
      total,
      currency: payment.currency ?? "EUR",
      status: "PAID",
    });
  }

  const notifications: Record<string, unknown>[] = [
    {
      user_id: payment.client_id,
      mission_id: payment.mission_id,
      event: "PAYMENT_CONFIRMED",
      title: payment.is_test ? "Paiement confirmé (mode test)" : "Paiement confirmé",
      body: "Votre facture est disponible dans vos paiements.",
    },
  ];
  if (payment.operator_id) {
    const { data: operator } = await supabase
      .from("operators")
      .select("user_id")
      .eq("id", payment.operator_id)
      .maybeSingle();
    if (operator?.user_id) {
      notifications.push({
        user_id: operator.user_id,
        mission_id: payment.mission_id,
        event: "PAYMENT_CONFIRMED",
        title: "Paiement client confirmé",
        body: "Le paiement de la mission a été encaissé.",
      });
    }
  }
  await supabase.from("notifications").insert(notifications);
}

