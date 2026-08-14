import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/** Webhook Stripe — la vérité du paiement vient d'ici, jamais du navigateur. */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook non configuré", { status: 503 });

        const signature = request.headers.get("stripe-signature");
        const payload = await request.text();
        if (!signature || !verifyStripeSignature(payload, signature, secret)) {
          return new Response("Signature invalide", { status: 401 });
        }

        const event = JSON.parse(payload) as { type: string; data: { object: any } };
        const object = event.data?.object ?? {};
        const paymentId: string | undefined = object?.metadata?.payment_id;
        if (!paymentId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("id", paymentId)
          .maybeSingle();
        if (!payment) return new Response("ok");

        if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
          if (payment.status !== "PAID") {
            await supabaseAdmin
              .from("payments")
              .update({
                stripe_payment_intent_id: object.payment_intent ?? object.id ?? null,
                stripe_customer_id: object.customer ?? null,
              })
              .eq("id", payment.id);
            const { markPaid } = await import("@/lib/payments.server");
            await markPaid(supabaseAdmin, payment);
          }
        } else if (
          event.type === "payment_intent.payment_failed" ||
          event.type === "checkout.session.async_payment_failed"
        ) {
          await supabaseAdmin
            .from("payments")
            .update({
              status: "FAILED",
              failure_reason: object?.last_payment_error?.message ?? "Paiement refusé",
            })
            .eq("id", payment.id);
          await supabaseAdmin
            .from("missions")
            .update({ payment_status: "failed" })
            .eq("id", payment.mission_id);
        } else if (event.type === "checkout.session.expired") {
          await supabaseAdmin
            .from("payments")
            .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
            .eq("id", payment.id);
        }

        return new Response("ok");
      },
    },
  },
});

function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string]),
  );
  const timestamp = parts["t"];
  const provided = parts["v1"];
  if (!timestamp || !provided) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
