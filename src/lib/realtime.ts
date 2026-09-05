import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Suivi en direct d'une mission : rafraîchit les requêtes dès qu'un
 * changement de statut ou un nouvel événement est enregistré.
 */
export function useMissionRealtime(missionId: string | undefined, queryKeys: unknown[][]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!missionId) return;
    const invalidate = () => {
      for (const key of queryKeys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };
    const channel = supabase
      .channel(`mission-live-${missionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missions", filter: `id=eq.${missionId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mission_events",
          filter: `mission_id=eq.${missionId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, queryClient]);
}
