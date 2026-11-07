import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const Body = z.object({ id: z.string().uuid() });

/** Path opened when the user taps the push, by role. */
function missionPath(role: string | null, missionId: string | null): string {
  if (!missionId) return role === "admin" ? "/admin" : "/";
  if (role === "tow_operator") return `/depanneur/mission/${missionId}`;
  if (role === "company") return `/entreprise/mission/${missionId}`;
  if (role === "admin") return `/admin/mission/${missionId}`;
  return `/client/mission/${missionId}`;
}

/**
 * Called by the database right after a notification row is inserted.
 * The caller is not trusted: we only receive an id, re-read the row with
 * privileged access, and claim it atomically so each notification is pushed
 * at most once, only to its owner's devices.
 */
export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("bad request", { status: 400 });

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const fcmKey = process.env["FIREBASE_MESSAGING_API_KEY"];
        if (!lovableKey || !fcmKey) return new Response("not configured", { status: 503 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: n } = await supabaseAdmin
          .from("notifications")
          .update({ push_claimed_at: new Date().toISOString() })
          .eq("id", parsed.data.id)
          .is("push_claimed_at", null)
          .gte("created_at", since)
          .select("id, user_id, mission_id, event, title, body, category")
          .maybeSingle();
        if (!n) return Response.json({ skipped: "already handled" });

        const { data: prefs } = await supabaseAdmin
          .from("notification_preferences")
          .select("push_enabled, categories")
          .eq("user_id", n.user_id)
          .maybeSingle();
        const cats = (prefs?.categories ?? {}) as Record<string, boolean>;
        const category = n.category ?? "missions";
        // Mission alerts are always delivered while push is enabled.
        if (prefs && (!prefs.push_enabled || (category !== "missions" && cats[category] === false))) {
          return Response.json({ skipped: "preferences" });
        }

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, token")
          .eq("user_id", n.user_id);
        if (!subs?.length) return Response.json({ sent: 0 });

        const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", n.user_id);
        const roleList = (roles ?? []).map((r) => r.role as string);
        const role = roleList.includes("admin") && n.event.startsWith("ADMIN") ? "admin"
          : roleList.find((r) => r !== "admin") ?? roleList[0] ?? null;
        const link = missionPath(role, n.mission_id);
        const urgent = category === "missions" || category === "new_missions";

        let sent = 0;
        for (const s of subs) {
          const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": fcmKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: s.token,
                data: { title: n.title, body: n.body ?? "", link, tag: `${n.mission_id ?? n.id}-${n.event}`, id: n.id },
                android: { priority: urgent ? "HIGH" : "NORMAL" },
                webpush: { headers: { Urgency: urgent ? "high" : "normal", TTL: "3600" }, fcm_options: { link } },
              },
            }),
          });
          if (res.ok) {
            sent++;
            continue;
          }
          const text = await res.text();
          if (res.status === 404 || (res.status === 400 && /UNREGISTERED|registration token/i.test(text))) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            console.error(`FCM send failed [${res.status}]: ${text}`);
          }
        }
        await supabaseAdmin.from("notifications").update({ push_sent_count: sent }).eq("id", n.id);
        return Response.json({ sent });
      },
    },
  },
});
