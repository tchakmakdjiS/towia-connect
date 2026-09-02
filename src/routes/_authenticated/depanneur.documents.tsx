import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { OPERATOR_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/depanneur/documents")({
  head: () => ({
    meta: [
      { title: "Mes documents — Dépanneur TowIA" },
      {
        name: "description",
        content: "Déposez votre Kbis, assurance, carte grise et permis pour la validation TowIA.",
      },
      { property: "og:title", content: "Mes documents — Dépanneur TowIA" },
      { property: "og:description", content: "Justificatifs professionnels et statut de validation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OperatorDocuments,
});

const DOC_TYPES = [
  "Kbis / justificatif d'entreprise",
  "Assurance professionnelle",
  "Carte grise du véhicule",
  "Permis de conduire",
  "Autre document",
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  VERIFIED: "Validé",
  REJECTED: "Refusé",
  SUSPENDED: "Suspendu",
};

function statusTone(status: string) {
  if (status === "VERIFIED") return "bg-success/15 text-success";
  if (status === "REJECTED" || status === "SUSPENDED") return "bg-destructive/15 text-destructive";
  return "bg-warning/15 text-warning";
}

function OperatorDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState(DOC_TYPES[0]!);
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const operator = useQuery({
    queryKey: ["operator", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const operatorId = operator.data?.id;

  const documents = useQuery({
    queryKey: ["operator-documents", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("operator_id", operatorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = async () => {
    if (!user || !operatorId || !file) return;
    setBusy(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("operator-documents").upload(path, file);
    if (up.error) {
      setBusy(false);
      toast.error("Envoi du fichier impossible. Veuillez réessayer.");
      return;
    }
    const { error } = await supabase.from("documents").insert({
      operator_id: operatorId,
      company_id: operator.data?.company_id ?? null,
      name: file.name,
      type,
      storage_path: path,
      expires_at: expiresAt || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Enregistrement du document impossible.");
      return;
    }
    setFile(null);
    setExpiresAt("");
    toast.success("Document déposé. Il sera vérifié par TowIA.");
    void queryClient.invalidateQueries({ queryKey: ["operator-documents", operatorId] });
  };

  const openDocument = async (storagePath: string | null) => {
    if (!storagePath) return;
    const { data, error } = await supabase.storage
      .from("operator-documents")
      .createSignedUrl(storagePath, 300);
    if (error || !data) {
      toast.error("Ouverture du document impossible.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const list = documents.data ?? [];

  return (
    <AppShell title="Mes documents" subtitle="Justificatifs professionnels" nav={OPERATOR_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Section
          title="Déposer un document"
          description="Kbis, assurance professionnelle, carte grise, permis…"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DOC_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-xl border p-3 text-left text-xs font-medium ${
                    type === t
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-file">Fichier (PDF ou image)</Label>
              <Input
                id="doc-file"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-expire">Date d'expiration (facultatif)</Label>
              <Input
                id="doc-expire"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              className="h-12 w-full rounded-2xl bg-gradient-primary font-semibold"
              disabled={!file || !operatorId || busy}
              onClick={() => void upload()}
            >
              {busy ? "Envoi en cours…" : "DÉPOSER LE DOCUMENT"}
            </Button>
            {!operatorId ? (
              <p className="text-xs text-muted-foreground">
                Complétez d'abord votre profil professionnel pour déposer vos documents.
              </p>
            ) : null}
          </div>
        </Section>

        <Section title="Mes documents" description="Statut de vérification géré par TowIA.">
          {list.length === 0 ? (
            <EmptyState title="Aucun document déposé" />
          ) : (
            <ul className="space-y-2">
              {list.map((d) => (
                <li key={d.id} className="rounded-2xl border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{d.name}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone(d.status)}`}
                    >
                      {STATUS_LABELS[d.status] ?? d.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.type ?? "—"} · déposé le {formatDate(d.created_at)}
                    {d.expires_at ? ` · expire le ${formatDate(d.expires_at)}` : ""}
                  </p>
                  {d.rejection_reason ? (
                    <p className="mt-1 text-xs text-destructive">Motif : {d.rejection_reason}</p>
                  ) : null}
                  {d.storage_path ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3 rounded-xl"
                      onClick={() => void openDocument(d.storage_path)}
                    >
                      Ouvrir
                    </Button>
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
