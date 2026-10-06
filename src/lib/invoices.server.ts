/** Server-only: builds invoice PDFs and stores them in the private "invoices" bucket. */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { CATEGORY_LABELS } from "@/lib/towia";

export const INVOICE_BUCKET = "invoices";

// WinAnsi-safe amount formatting (Intl uses narrow no-break spaces the standard fonts can't encode).
function eur(n: number) {
  const [i, d] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${(i ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${d} EUR`;
}
function safe(s: unknown) {
  return String(s ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF€’–—]/g, "");
}
function frDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export async function buildInvoicePdf(admin: any, invoice: any): Promise<Uint8Array> {
  const [{ data: mission }, { data: client }, companyRes, operatorRes] = await Promise.all([
    admin.from("missions").select("category, address, city, postal_code, created_at, completed_at").eq("id", invoice.mission_id).maybeSingle(),
    admin.from("profiles").select("first_name, last_name, email, address, city, postal_code").eq("id", invoice.client_id).maybeSingle(),
    invoice.company_id
      ? admin.from("companies").select("name, legal_name, siret, address, city, postal_code").eq("id", invoice.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.operator_id
      ? admin.from("operators").select("first_name, last_name, professional_name, company_name, city").eq("id", invoice.operator_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const company = companyRes.data;
  const operator = operatorRes.data;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Facture ${invoice.invoice_number}`);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const orange = rgb(0.976, 0.451, 0.086);
  const grey = rgb(0.4, 0.4, 0.4);
  let y = 790;
  const text = (t: string, x: number, size = 10, f = font, color = rgb(0, 0, 0)) =>
    page.drawText(safe(t), { x, y, size, font: f, color });

  text("TowIA", 50, 24, bold, orange);
  text("FACTURE", 400, 20, bold);
  y -= 22;
  text("Assistance automobile", 50, 10, font, grey);
  text(`N° ${invoice.invoice_number}`, 400, 10);
  y -= 14;
  text(`Date : ${frDate(invoice.issued_at ?? invoice.created_at)}`, 400, 10);

  y -= 50;
  text("Prestataire", 50, 11, bold);
  text("Client", 320, 11, bold);
  y -= 16;
  const providerLines = company
    ? [company.legal_name || company.name, company.address, [company.postal_code, company.city].filter(Boolean).join(" "), company.siret ? `SIRET ${company.siret}` : ""]
    : operator
      ? [operator.professional_name || operator.company_name || [operator.first_name, operator.last_name].filter(Boolean).join(" "), operator.city]
      : ["TowIA"];
  const clientLines = [
    [client?.first_name, client?.last_name].filter(Boolean).join(" ") || "Client",
    client?.email,
    client?.address,
    [client?.postal_code, client?.city].filter(Boolean).join(" "),
  ];
  const max = Math.max(providerLines.length, clientLines.length);
  for (let i = 0; i < max; i++) {
    if (providerLines[i]) text(String(providerLines[i]), 50);
    if (clientLines[i]) text(String(clientLines[i]), 320);
    y -= 14;
  }

  y -= 30;
  page.drawRectangle({ x: 50, y: y - 6, width: 495, height: 22, color: rgb(0.95, 0.95, 0.95) });
  text("Désignation", 58, 10, bold);
  text("Montant HT", 460, 10, bold);
  y -= 26;
  const label = mission ? CATEGORY_LABELS[mission.category as keyof typeof CATEGORY_LABELS] ?? "Intervention" : "Intervention";
  text(`Intervention TowIA – ${label}`, 58);
  text(eur(Number(invoice.subtotal)), 460);
  y -= 14;
  const place = [mission?.address, mission?.postal_code, mission?.city].filter(Boolean).join(", ");
  if (place) { text(place.slice(0, 80), 58, 9, font, grey); y -= 12; }
  text(`Mission #${String(invoice.mission_id).slice(0, 8).toUpperCase()}`, 58, 9, font, grey);

  y -= 40;
  const totals: [string, string, boolean][] = [
    ["Total HT", eur(Number(invoice.subtotal)), false],
    ["TVA (20 %)", eur(Number(invoice.tax_amount)), false],
    ["Total TTC", eur(Number(invoice.total)), true],
  ];
  for (const [k, v, b] of totals) {
    text(k, 340, b ? 12 : 10, b ? bold : font);
    text(v, 460, b ? 12 : 10, b ? bold : font);
    y -= 18;
  }
  y -= 10;
  text(`Statut : ${invoice.status === "PAID" ? "Payée" : safe(invoice.status)}`, 340, 10, bold, orange);

  y = 60;
  text("Facture générée par TowIA. Paiement traité via la plateforme TowIA.", 50, 8, font, grey);
  return pdf.save();
}

/** Returns the storage path of the invoice PDF, generating and uploading it if missing. */
export async function ensureInvoicePdf(admin: any, invoice: any): Promise<string> {
  const path = invoice.storage_path ?? `${invoice.client_id}/${invoice.id}.pdf`;
  if (invoice.storage_path) {
    const folder = path.split("/").slice(0, -1).join("/");
    const { data } = await admin.storage.from(INVOICE_BUCKET).list(folder, { search: path.split("/").pop() });
    if (data?.length) return path;
  }
  const bytes = await buildInvoicePdf(admin, invoice);
  const { error } = await admin.storage
    .from(INVOICE_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Stockage de la facture impossible : ${error.message}`);
  await admin.from("invoices").update({ storage_path: path }).eq("id", invoice.id);
  return path;
}
