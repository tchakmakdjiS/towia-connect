import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
    ],
  }),
  component: AdminUsers,
});

function AdminUsers() {
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
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const list = users.data ?? [];

  return (
    <AppShell title="Utilisateurs" subtitle="Comptes et rôles" nav={ADMIN_NAV}>
      <Section title="Tous les utilisateurs">
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
                    Inscrit le {formatDate(u.created_at)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {u.roles.length > 0 ? u.roles.join(", ") : "aucun rôle"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
