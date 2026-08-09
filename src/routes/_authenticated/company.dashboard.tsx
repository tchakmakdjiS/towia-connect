import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Truck, Activity, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { COMPANY_NAV } from "@/lib/nav";
import { Section, StatCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import {
  ACTIVE_STATUSES,
  CATEGORY_LABELS,
  formatAmount,
  formatDate,
  type MissionStatus,
} from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/company/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord entreprise — TowIA" },
      { name: "description", content: "Pilotez votre flotte, votre équipe et vos missions TowIA." },
      { property: "og:title", content: "Tableau de bord entreprise — TowIA" },
      { property: "og:description", content: "Pilotez votre flotte et vos missions." },
    ],
  }),
  component: CompanyDashboard,
});

export function useCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function CompanyDashboard() {
  const company = useCompany();
  const companyId = company.data?.id;

  const missions = useQuery({
    queryKey: ["company-missions", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const operators = useQuery({
    queryKey: ["company-operators", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });

  const vehicles = useQuery({
    queryKey: ["company-vehicles", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
  });

  const payments = useQuery({
    queryKey: ["company-payments", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("professional_amount, status");
      if (error) throw error;
      return data;
    },
  });

  const list = missions.data ?? [];
  const active = list.filter((m) => ACTIVE_STATUSES.includes(m.status as MissionStatus));
  const revenue = (payments.data ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.professional_amount ?? 0), 0);

  return (
    <AppShell
      title={company.data?.name ?? "Espace entreprise"}
      subtitle="Vue d'ensemble"
      nav={COMPANY_NAV}
    >
      <div className="space-y-6">
        {!company.data ? (
          <EmptyState
            title="Profil entreprise incomplet"
            description="Renseignez vos informations dans « Profil entreprise » pour activer votre espace."
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Missions en cours" value={active.length} icon={<Activity className="size-5" />} />
          <StatCard label="Équipe" value={operators.data?.length ?? 0} icon={<Users className="size-5" />} />
          <StatCard label="Véhicules" value={vehicles.data?.length ?? 0} icon={<Truck className="size-5" />} />
          <StatCard label="Revenus encaissés" value={formatAmount(revenue)} icon={<Wallet className="size-5" />} />
        </div>

        <Section title="Dernières missions">
          {list.length === 0 ? (
            <EmptyState title="Aucune mission" />
          ) : (
            <ul className="space-y-2">
              {list.slice(0, 8).map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
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
