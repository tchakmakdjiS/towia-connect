import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns a short-lived signed URL for an invoice PDF.
 * Access is decided by the invoices RLS policy, evaluated as the caller:
 * if the caller cannot read the row, access is denied.
 */
export const getInvoicePdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invoiceId: z.string().uuid(), download: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: invoice, error } = await context.supabase
      .from("invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (error || !invoice) throw new Error("Accès refusé : facture introuvable ou non autorisée.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureInvoicePdf, INVOICE_BUCKET } = await import("@/lib/invoices.server");
    const path = await ensureInvoicePdf(supabaseAdmin, invoice);
    const fileName = `Facture-${invoice.invoice_number}.pdf`;
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(INVOICE_BUCKET)
      .createSignedUrl(path, 300, data.download ? { download: fileName } : undefined);
    if (sErr || !signed) throw new Error("Lien de facture indisponible, réessayez.");
    return { url: signed.signedUrl, fileName };
  });
