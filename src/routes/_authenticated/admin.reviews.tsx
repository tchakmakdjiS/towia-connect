import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/nav";
import { Section, EmptyState } from "@/components/ui-kit";
import { formatDate } from "@/lib/towia";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  head: () => ({
    meta: [
      { title: "Avis — Administration TowIA" },
      { name: "description", content: "Modération des avis clients sur les interventions." },
      { property: "og:title", content: "Avis — Administration TowIA" },
      { property: "og:description", content: "Modération des avis clients." },
    ],
  }),
  component: AdminReviews,
});

function AdminReviews() {
  const reviews = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = reviews.data ?? [];

  return (
    <AppShell title="Avis" subtitle="Qualité de service" nav={ADMIN_NAV}>
      <Section title="Avis clients">
        {list.length === 0 ? (
          <EmptyState title="Aucun avis" />
        ) : (
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 font-medium">
                    <Star className="size-4 fill-primary text-primary" /> {r.rating}/5
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>
                {r.comment ? <p className="mt-2 text-muted-foreground">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}
