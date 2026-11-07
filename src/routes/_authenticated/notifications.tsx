import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { currentDeviceToken, enablePush } from "@/lib/push";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — TowIA" },
      { name: "description", content: "Gérez vos notifications sur téléphone et vos appareils TowIA." },
      { property: "og:title", content: "Notifications — TowIA" },
      { property: "og:description", content: "Gérez vos notifications sur téléphone et vos appareils TowIA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsSettings,
});

const DEFAULT_CATS = { missions: true, new_missions: true, payments: true, admin: true, messages: true };

function NotificationsSettings() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [myToken, setMyToken] = useState<string | null>(null);
  useEffect(() => setMyToken(currentDeviceToken()), []);

  const prefs = useQuery({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notification_preferences").select("*").eq("user_id", user!.id).maybeSingle();
      return data ?? { user_id: user!.id, push_enabled: true, categories: DEFAULT_CATS };
    },
  });
  const devices = useQuery({
    queryKey: ["push-devices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("push_subscriptions").select("id, token, device_label, created_at, last_seen_at").order("last_seen_at", { ascending: false });
      return data ?? [];
    },
  });
  const history = useQuery({
    queryKey: ["notif-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("id, title, body, created_at, read_at").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const cats = { ...DEFAULT_CATS, ...((prefs.data?.categories ?? {}) as Record<string, boolean>) };

  async function save(patch: { push_enabled?: boolean; categories?: Record<string, boolean> }) {
    if (!user) return;
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      push_enabled: patch.push_enabled ?? prefs.data?.push_enabled ?? true,
      categories: patch.categories ?? cats,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error("Enregistrement impossible");
    void qc.invalidateQueries({ queryKey: ["notif-prefs", user.id] });
  }

  async function activate() {
    setBusy(true);
    try {
      const r = await enablePush();
      const msg: Record<string, string> = {
        registered: "Notifications activées sur cet appareil.",
        denied: "Notifications bloquées. Autorisez-les dans les réglages du site de votre navigateur.",
        "open-in-new-tab": "Ouvrez TowIA dans son propre onglet (ou l'appli installée) pour activer les notifications.",
        "ios-install": "Sur iPhone : touchez Partager, puis « Sur l'écran d'accueil », ouvrez TowIA depuis l'icône et réessayez.",
        unsupported: "Cet appareil ou ce navigateur ne prend pas en charge les notifications.",
        "not-configured": "Les notifications ne sont pas encore configurées sur TowIA.",
      };
      (r.status === "registered" ? toast.success : toast.message)(msg[r.status]);
      if (r.status === "registered") {
        setMyToken(r.token);
        await save({ push_enabled: true });
        void qc.invalidateQueries({ queryKey: ["push-devices", user?.id] });
      }
    } catch {
      toast.error("Activation impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(id: string) {
    await supabase.from("push_subscriptions").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["push-devices", user?.id] });
  }

  const catRows: { key: keyof typeof DEFAULT_CATS; label: string; locked?: boolean; show: boolean }[] = [
    { key: "missions", label: "Suivi de mes missions (prioritaire)", locked: true, show: true },
    { key: "new_missions", label: "Nouvelles missions disponibles", show: role === "tow_operator" || role === "company" },
    { key: "payments", label: "Paiements et factures", show: true },
    { key: "messages", label: "Messages", show: true },
    { key: "admin", label: "Activité d'administration", show: role === "admin" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Notifications sur téléphone</p>
            <p className="text-sm text-muted-foreground">Reçues même quand TowIA est fermée.</p>
          </div>
          <Switch checked={prefs.data?.push_enabled ?? true} onCheckedChange={(v) => void save({ push_enabled: v })} />
        </div>
        <Button onClick={() => void activate()} disabled={busy}>
          {busy ? "Activation…" : "Activer sur cet appareil"}
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="font-medium">Catégories</p>
        {catRows.filter((c) => c.show).map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-4">
            <span className="text-sm">{c.label}</span>
            <Switch
              checked={c.locked ? true : cats[c.key]}
              disabled={c.locked}
              onCheckedChange={(v) => void save({ categories: { ...cats, [c.key]: v } })}
            />
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="font-medium">Mes appareils</p>
        {(devices.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun appareil enregistré.</p>
        ) : (
          <ul className="divide-y divide-border">
            {devices.data!.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm">{d.device_label ?? "Appareil"}{d.token === myToken ? " (cet appareil)" : ""}</p>
                  <p className="text-xs text-muted-foreground">Ajouté le {new Date(d.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void removeDevice(d.id)}>Retirer</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="font-medium">Historique</p>
        <ul className="divide-y divide-border">
          {(history.data ?? []).map((n) => (
            <li key={n.id} className="py-2">
              <p className="text-sm font-medium">{n.title}</p>
              {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
              <p className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
