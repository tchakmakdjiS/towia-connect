import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getInvoicePdfUrl } from "@/lib/invoices.functions";

/**
 * "Voir la facture" / "Télécharger PDF".
 * Uses plain https signed URLs (no blob:) so Android WebViews can hand the file
 * to the system downloader / PDF reader.
 */
export function InvoiceActions({ invoiceId }: { invoiceId: string }) {
  const fetchUrl = useServerFn(getInvoicePdfUrl);
  const [busy, setBusy] = useState<null | "view" | "download">(null);

  const run = async (mode: "view" | "download") => {
    setBusy(mode);
    // Open the tab synchronously (before await) so popup blockers allow it.
    const win = mode === "view" ? window.open("", "_blank") : null;
    try {
      const { url } = await fetchUrl({ data: { invoiceId, download: mode === "download" } });
      if (mode === "view" && win) {
        win.location.href = url;
      } else if (mode === "view") {
        window.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      win?.close();
      toast.error(e instanceof Error ? e.message : "Facture indisponible");
    } finally {
      setBusy(null);
    }
  };

  return (
    <span className="inline-flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" className="h-8 rounded-xl" disabled={!!busy} onClick={() => void run("view")}>
        {busy === "view" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Eye className="mr-1 size-3.5" />}
        Voir la facture
      </Button>
      <Button size="sm" variant="secondary" className="h-8 rounded-xl" disabled={!!busy} onClick={() => void run("download")}>
        {busy === "download" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Download className="mr-1 size-3.5" />}
        Télécharger PDF
      </Button>
    </span>
  );
}
