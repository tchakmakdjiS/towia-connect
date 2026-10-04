import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { useCompany } from "@/lib/company";
import { Section, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTeamAccountStates, inviteTeamOperator, reinviteTeamOperator } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/entreprise/operators")({
  head: () => ({
    meta: [
      { title: "Équipe — TowIA" },
      { name: "description", content: "Gérez et invitez les dépanneurs de votre entreprise." },
      { property: "og:title", content: "Équipe — TowIA" },
      { property: "og:description", content: "Gérez et invitez les dépanneurs de votre entreprise." },
    ],
  }),
  component: CompanyOperators,
});

const ACCOUNT_LABEL: Record<string, string> = {
  INVITED: "Invitation envoyée",
  ACTIVE: "Actif",
  DISABLED: "Désactivé",
  NO_ACCOUNT: "Sans compte",
};
const AVAIL_LABEL: Record<string, string> = {
  AVAILABLE: "Disponible",
  UNAVAILABLE: "Indisponible",
  ON_MISSION: "En mission",
};

function CompanyOperators() {
  const company = useCompany();
  const companyId = company.data?.id;
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteTeamOperator);
  const reinvite = useServerFn(reinviteTeamOperator);
  const fetchStates = useServerFn(getTeamAccountStates);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ first_name: "", last_name: "", phone: "" });

  const operators = useQuery({
    queryKey: ["company-operators-all", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("operators").select("*").eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });
  const states = useQuery({
    queryKey: ["company-team-states", companyId],
    enabled: !!companyId,
    queryFn: () => fetchStates(),
  });
  const ongoing = useQuery({
    queryKey: ["company-team-ongoing", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("missions")
        .select("operator_id")
        .eq("company_id", companyId!)
        .in("status", ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"]);
      const c: Record<string, number> = {};
      for (const m of data ?? []) if (m.operator_id) c[m.operator_id] = (c[m.operator_id] ?? 0) + 1;
      return c;
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["company-operators-all", companyId] });
    void queryClient.invalidateQueries({ queryKey: ["company-team-states", companyId] });
  };
  const redirectTo = () => `${window.location.origin}/reset-password`;

  const sendInvite = async () => {
    setSending(true);
    try {
      await invite({ data: { ...form, phone: form.phone || null, redirectTo: redirectTo() } });
      toast.success("Invitation envoyée par e-mail");
      setForm({ firstName: "", lastName: "", email: "", phone: "" });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invitation impossible");
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (id: string, account_status: "ACTIVE" | "DISABLED") => {
    const { error } = await supabase.from("operators").update({ account_status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(account_status === "DISABLED" ? "Dépanneur désactivé" : "Dépanneur réactivé");
    refresh();
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("operators")
      .update({ first_name: edit.first_name, last_name: edit.last_name, phone: edit.phone || null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    refresh();
  };

  return (
    <AppShell title="Équipe" subtitle="Dépanneurs rattachés" nav={COMPANY_NAV}>
      <Section title="Inviter un dépanneur">
        <p className="mb-3 text-xs text-muted-foreground">
          Le dépanneur reçoit un e-mail, choisit lui-même son mot de passe et accède à son espace Dépanneur.
        </p>
        <div className="grid gap-3 sm:grid-cols-5">
          <Input placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded-xl" />
          <Input placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded-xl" />
          <Input type="email" placeholder="Adresse e-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" />
          <Input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl" />
          <Button
            className="rounded-xl"
            disabled={!companyId || !form.firstName || !form.lastName || !form.email.includes("@") || sending}
            onClick={() => void sendInvite()}
          >
            {sending ? "Envoi…" : "Envoyer l'invitation"}
          </Button>
        </div>
      </Section>

      <Section title="Mes dépanneurs">
        {(operators.data?.length ?? 0) === 0 ? (
          <EmptyState title="Aucun dépanneur" description="Invitez les membres de votre équipe." />
        ) : (
          <ul className="space-y-2">
            {operators.data!.map((o) => {
              const st = o.account_status === "DISABLED" ? "DISABLED" : (states.data?.[o.id] ?? o.account_status);
              return (
                <li key={o.id} className="rounded-2xl border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{o.first_name} {o.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.email ?? "—"}{o.phone ? ` · ${o.phone}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{ACCOUNT_LABEL[st] ?? st}</p>
                      <p>
                        {AVAIL_LABEL[o.availability] ?? o.availability} · {ongoing.data?.[o.id] ?? 0} mission(s) en cours
                      </p>
                    </div>
                  </div>
                  {viewing === o.id ? (
                    <div className="mt-3 grid gap-1 rounded-xl bg-muted/40 p-3 text-xs">
                      <p>Validation : {o.verification}</p>
                      <p>Zone : {o.intervention_zone ?? "—"}</p>
                      <p>Véhicule : {o.vehicle_type ?? o.vehicle_label ?? "—"}</p>
                      <p>Note : {o.rating ?? "—"}</p>
                      <p>Dernière position : {o.last_position_at ? new Date(o.last_position_at).toLocaleString("fr-FR") : "—"}</p>
                    </div>
                  ) : null}
                  {editing === o.id ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <Input value={edit.first_name} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} className="rounded-xl" />
                      <Input value={edit.last_name} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} className="rounded-xl" />
                      <Input value={edit.phone} placeholder="Téléphone" onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className="rounded-xl" />
                      <Button className="rounded-xl" onClick={() => void saveEdit(o.id)}>Enregistrer</Button>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setViewing(viewing === o.id ? null : o.id)}>
                      Voir le profil
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setEditing(editing === o.id ? null : o.id);
                        setEdit({ first_name: o.first_name ?? "", last_name: o.last_name ?? "", phone: o.phone ?? "" });
                      }}
                    >
                      Modifier
                    </Button>
                    {st === "DISABLED" ? (
                      <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => void setStatus(o.id, "ACTIVE")}>
                        Réactiver
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => void setStatus(o.id, "DISABLED")}>
                        Désactiver
                      </Button>
                    )}
                    {st === "INVITED" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() =>
                          void reinvite({ data: { operatorId: o.id, redirectTo: redirectTo() } })
                            .then(() => toast.success("Invitation renvoyée"))
                            .catch((e: Error) => toast.error(e.message))
                        }
                      >
                        Réinviter
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
