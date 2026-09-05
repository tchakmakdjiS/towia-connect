import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/towia";

/** Cloche de notifications en direct (missions acceptées, en route, arrivée, etc.). */
export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { title?: string; body?: string };
          if (row.title) toast(row.title, { description: row.body ?? undefined });
          void queryClient.invalidateQueries({ queryKey: ["my-notifications", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const list = notifications.data ?? [];
  const unread = list.filter((n) => !n.read_at);

  const markAllRead = async () => {
    if (unread.length === 0 || !user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    void queryClient.invalidateQueries({ queryKey: ["my-notifications", user.id] });
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unread.length > 0 ? (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 ? (
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => void markAllRead()}
            >
              Tout marquer comme lu
            </button>
          ) : null}
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-auto">
          {list.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              Aucune notification
            </li>
          ) : (
            list.map((n) => (
              <li key={n.id} className={`px-4 py-3 ${n.read_at ? "" : "bg-muted/40"}`}>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(n.created_at)}</p>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
