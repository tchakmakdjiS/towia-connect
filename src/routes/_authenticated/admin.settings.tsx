import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section } from "@/components/ui-kit";
import { DEMO_COMMISSION_RATE, MISSION_CATEGORIES, NOTIFICATION_EVENTS } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres — Administration TowIA" },
      { name: "description", content: "Paramètres plateforme : commission, catégories et notifications." },
      { property: "og:title", content: "Paramètres — Administration TowIA" },
      { property: "og:description", content: "Paramètres plateforme TowIA." },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <AppShell title="Paramètres" subtitle="Configuration plateforme" nav={ADMIN_NAV}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Section
          title="Commission plateforme"
          description="Taux appliqué au calcul de répartition. Modifiable côté base de données."
        >
          <p className="text-2xl font-semibold text-primary">
            {(DEMO_COMMISSION_RATE * 100).toFixed(0)} %
          </p>
        </Section>

        <Section title="Catégories d'intervention">
          <div className="flex flex-wrap gap-2">
            {MISSION_CATEGORIES.map((c) => (
              <span key={c.value} className="rounded-full border border-border px-3 py-1 text-xs">
                {c.label}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Événements de notification">
          <ul className="space-y-1 text-sm text-muted-foreground">
            {NOTIFICATION_EVENTS.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Section>
      </div>
    </AppShell>
  );
}
