import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, formatDate } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/admin/operators")({
  head: () => ({
    meta: [
      { title: "Professionnels — Administration TowIA" },
      { name: "description", content: "Validation et suivi des dépanneurs de la plateforme." },
      { property: "og:title", content: "Professionnels — Administration TowIA" },
      { property: "og:description", content: "Validation et suivi des dépanneurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminOperators,
});

type Verification = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";

const FILTERS: { value: Verification | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "VERIFIED", label: "Validés" },
  { value: "SUSPENDED", label: "Suspendus" },
  { value: "REJECTED", label: "Refusés" },
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

function AdminOperators() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Verification | "ALL">("PENDING");
  const [openId, setOpenId] = useState<string | null>(null);

  const operators = useQuery({
    queryKey: ["admin-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const sensitive = useQuery({
    queryKey: ["admin-operator-sensitive", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_sensitive")
        .select("siret")
        .eq("operator_id", openId!)
        .maybeSingle();
      return data;
    },
  });


  const documents = useQuery({
    queryKey: ["admin-operator-documents", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("operator_id", openId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setVerification = async (id: string, verification: Verification) => {
    const { error } = await supabase.from("operators").update({ verification }).eq("id", id);
    if (error) {
      toast.error("Mise à jour impossible.");
      return;
    }
    if (verification !== "VERIFIED") {
      await supabase
        .from("operators")
        .update({ is_available: false, availability: "UNAVAILABLE" })
        .eq("id", id);
    }
    toast.success(`Dépanneur : ${STATUS_LABELS[verification]}`);
    void queryClient.invalidateQueries({ queryKey: ["admin-operators"] });
  };

  const setDocumentStatus = async (
    docId: string,
    status: "VERIFIED" | "REJECTED" | "PENDING",
  ) => {
    const { error } = await supabase
      .from("documents")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", docId);
    if (error) {
      toast.error("Mise à jour du document impossible.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["admin-operator-documents", openId] });
  };

  const openDocument = async (storagePath: string | null, fileUrl: string | null) => {
    if (!storagePath) {
      if (fileUrl) window.open(fileUrl, "_blank", "noopener");
      return;
    }
    const { data, error } = await supabase.storage
      .from("operator-documents")
      .createSignedUrl(storagePath, 300);
    if (error || !data) {
      toast.error("Ouverture du document impossible.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const all = operators.data ?? [];
  const list = filter === "ALL" ? all : all.filter((o) => o.verification === filter);
  const pendingCount = all.filter((o) => o.verification === "PENDING").length;

  return (
    <AppShell
      title="Professionnels"
      subtitle={`${pendingCount} dépanneur(s) en attente de validation`}
      nav={ADMIN_NAV}
    >
      <Section title="Dépanneurs" description="Validation, suspension et réactivation des comptes.">
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                filter === f.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState title="Aucun professionnel" />
        ) : (
          <ul className="space-y-2">
            {list.map((o) => {
              const open = openId === o.id;
              return (
                <li key={o.id} className="rounded-2xl border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {o.first_name ?? "—"} {o.last_name ?? ""}
                        {o.company_name ? ` · ${o.company_name}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Inscrit le {formatDate(o.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone(o.verification)}`}
                    >
                      {STATUS_LABELS[o.verification] ?? o.verification}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 rounded-xl px-0 text-xs"
                    onClick={() => setOpenId(open ? null : o.id)}
                  >
                    {open ? "Masquer le dossier" : "Consulter le dossier"}
                  </Button>

                  {open ? (
                    <div className="mt-3 space-y-4 rounded-2xl bg-muted/20 p-4">
                      <dl className="grid gap-3 sm:grid-cols-2">
                        <Info label="Téléphone" value={o.phone} />
                        <Info label="Email" value={o.email} />
                        <Info label="SIRET" value={o.siret} />
                        <Info
                          label="Adresse"
                          value={[o.address, o.postal_code, o.city].filter(Boolean).join(" ")}
                        />
                        <Info
                          label="Zone d'intervention"
                          value={
                            [o.intervention_zone, o.service_radius_km ? `${o.service_radius_km} km` : null]
                              .filter(Boolean)
                              .join(" · ")
                          }
                        />
                        <Info label="Véhicule" value={o.vehicle_type} />
                        <Info label="24h/24 7j/7" value={o.available_24_7 ? "Oui" : "Non"} />
                        <Info
                          label="Services"
                          value={(o.services ?? [])
                            .map((s) => CATEGORY_LABELS[s as keyof typeof CATEGORY_LABELS] ?? s)
                            .join(", ")}
                        />
                      </dl>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Documents
                        </p>
                        {(documents.data ?? []).length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Aucun document déposé.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {(documents.data ?? []).map((d) => (
                              <li key={d.id} className="rounded-xl border border-border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">{d.name}</span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone(d.status)}`}
                                  >
                                    {STATUS_LABELS[d.status] ?? d.status}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {d.type ?? "—"} · {formatDate(d.created_at)}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-xl"
                                    onClick={() => void openDocument(d.storage_path, d.file_url)}
                                  >
                                    Ouvrir
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="rounded-xl bg-gradient-primary"
                                    onClick={() => void setDocumentStatus(d.id, "VERIFIED")}
                                  >
                                    Valider
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-xl"
                                    onClick={() => void setDocumentStatus(d.id, "REJECTED")}
                                  >
                                    Refuser
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.verification !== "VERIFIED" ? (
                      <Button
                        size="sm"
                        className="rounded-xl bg-gradient-primary"
                        onClick={() => void setVerification(o.id, "VERIFIED")}
                      >
                        {o.verification === "SUSPENDED" ? "Réactiver" : "Valider"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() => void setVerification(o.id, "SUSPENDED")}
                      >
                        Suspendre
                      </Button>
                    )}
                    {o.verification !== "REJECTED" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() => void setVerification(o.id, "REJECTED")}
                      >
                        Refuser
                      </Button>
                    ) : null}
                    {o.verification !== "PENDING" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => void setVerification(o.id, "PENDING")}
                      >
                        Remettre en attente
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value || "—"}</dd>
    </div>
  );
}
