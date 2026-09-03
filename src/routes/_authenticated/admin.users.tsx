import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { formatDate } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Utilisateurs — Administration TowIA" },
      { name: "description", content: "Comptes et rôles des utilisateurs TowIA." },
      { property: "og:title", content: "Utilisateurs — Administration TowIA" },
      { property: "og:description", content: "Comptes et rôles des utilisateurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminUsers,
});

const ROLE_FILTERS = [
  { value: "ALL", label: "Tous" },
  { value: "customer", label: "Automobilistes" },
  { value: "tow_operator", label: "Dépanneurs" },
  { value: "company", label: "Entreprises" },
  { value: "admin", label: "Administrateurs" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  customer: "Automobiliste",
  tow_operator: "Dépanneur",
  company: "Entreprise",
  admin: "Administrateur",
};

function AdminUsers() {
  const [filter, setFilter] = useState<(typeof ROLE_FILTERS)[number]["value"]>("ALL");

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      }));
    },
  });

  const all = users.data ?? [];
  const list = filter === "ALL" ? all : all.filter((u) => u.roles.includes(filter));

  return (
    <AppShell title="Utilisateurs" subtitle="Comptes et rôles" nav={ADMIN_NAV}>
      <Section title="Tous les utilisateurs" description="Filtrez les comptes par rôle.">
        <div className="mb-4 flex flex-wrap gap-2">
          {ROLE_FILTERS.map((f) => (
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
          <EmptyState title="Aucun utilisateur" />
        ) : (
          <ul className="space-y-2">
            {list.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {u.first_name ?? "—"} {u.last_name ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.email ?? "—"} · inscrit le {formatDate(u.created_at)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {u.roles.length > 0
                    ? u.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")
                    : "aucun rôle"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
