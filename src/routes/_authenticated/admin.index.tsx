import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Users, Building2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, StatCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import {
  ACTIVE_STATUSES,
  CATEGORY_LABELS,
  formatAmount,
  formatDate,
  type MissionStatus,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Supervision — Administration TowIA" },
      { name: "description", content: "Supervision temps réel des missions et de l'activité TowIA." },
      { property: "og:title", content: "Supervision — Administration TowIA" },
      { property: "og:description", content: "Supervision de l'activité TowIA." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const missions = useQuery({
    queryKey: ["admin-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const profiles = useQuery({
    queryKey: ["admin-profiles-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const companies = useQuery({
    queryKey: ["admin-companies-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const payments = useQuery({
    queryKey: ["admin-payments-sum"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("platform_fee, status");
      if (error) throw error;
      return data;
    },
  });

  const list = missions.data ?? [];
  const active = list.filter((m) => ACTIVE_STATUSES.includes(m.status as MissionStatus));
  const fees = (payments.data ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.platform_fee ?? 0), 0);

  return (
    <AppShell title="Supervision" subtitle="Administration TowIA" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Missions en cours" value={active.length} icon={<Activity className="size-5" />} />
          <StatCard label="Missions totales" value={list.length} icon={<Activity className="size-5" />} />
          <StatCard label="Utilisateurs" value={profiles.data ?? 0} icon={<Users className="size-5" />} />
          <StatCard label="Entreprises" value={companies.data ?? 0} icon={<Building2 className="size-5" />} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Commissions encaissées" value={formatAmount(fees)} icon={<Wallet className="size-5" />} />
        </div>

        <Section title="Flux de missions">
          {list.length === 0 ? (
            <EmptyState title="Aucune mission" />
          ) : (
            <ul className="space-y-2">
              {list.slice(0, 15).map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 text-sm"
                >
                  <div>
                    <p className="font-medium">{CATEGORY_LABELS[m.category]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                  </div>
                  <StatusBadge status={m.status as MissionStatus} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
