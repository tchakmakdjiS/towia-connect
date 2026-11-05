import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineKm } from "@/lib/distance";

export const LIVE_TRACKING_STATUSES = ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] as const;
export const isTrackable = (s?: string | null) =>
  !!s && (LIVE_TRACKING_STATUSES as readonly string[]).includes(s);

/** Envoi au plus toutes les 4 s, et seulement après un déplacement de 15 m (ou 30 s sans envoi). */
export const SEND_INTERVAL_MS = 4000;
export const MIN_MOVE_M = 15;
export const KEEPALIVE_MS = 30000;

export function shouldSend(
  last: { lat: number; lng: number; at: number } | null,
  next: { lat: number; lng: number; at: number },
): boolean {
  if (!last) return true;
  const dt = next.at - last.at;
  if (dt < SEND_INTERVAL_MS) return false;
  const movedM = haversineKm(last.lat, last.lng, next.lat, next.lng) * 1000;
  return movedM >= MIN_MOVE_M || dt >= KEEPALIVE_MS;
}

export type SharingState = "idle" | "starting" | "active" | "denied" | "unavailable" | "offline";

export function useLiveLocationSharing(opts: {
  missionId: string;
  operatorId?: string | null;
  status?: string | null;
}) {
  const { missionId, operatorId, status } = opts;
  const [state, setState] = useState<SharingState>("idle");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const pending = useRef<GeolocationPosition | null>(null);

  const send = useCallback(
    async (pos: GeolocationPosition) => {
      if (!operatorId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        pending.current = pos;
        setState("offline");
        return;
      }
      const { error } = await supabase.from("mission_live_locations").upsert({
        mission_id: missionId,
        operator_id: operatorId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        accuracy: pos.coords.accuracy,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        pending.current = pos;
        setState("offline");
        return;
      }
      pending.current = null;
      lastSent.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
      setLastSentAt(new Date());
      setState("active");
    },
    [missionId, operatorId],
  );

  const stop = useCallback(() => {
    if (watchId.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    lastSent.current = null;
    setState("idle");
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      return;
    }
    if (watchId.current != null) return;
    setState("starting");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
        if (shouldSend(lastSent.current, next)) void send(pos);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stop();
          setState("denied");
        } else setState("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  }, [send, stop]);

  // Reprise après coupure réseau
  useEffect(() => {
    const onOnline = () => {
      if (pending.current) void send(pending.current);
      else if (watchId.current != null) setState("active");
    };
    const onOffline = () => {
      if (watchId.current != null) setState("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [send]);

  // Arrêt automatique à la clôture
  useEffect(() => {
    if (!isTrackable(status)) stop();
  }, [status, stop]);

  // Arrêt en quittant la page
  useEffect(() => () => stop(), [stop]);

  return { state, lastSentAt, start, stop, sharing: watchId.current != null || state === "active" };
}

export type LiveLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  updated_at: string;
};

/** Côté client : lecture + abonnement temps réel à la position du dépanneur de la mission. */
export function useLiveLocation(missionId: string, enabled: boolean) {
  const [loc, setLoc] = useState<LiveLocation | null>(null);
  useEffect(() => {
    if (!enabled) {
      setLoc(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("mission_live_locations")
      .select("latitude, longitude, heading, updated_at")
      .eq("mission_id", missionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLoc(data);
      });
    const channel = supabase
      .channel(`live-loc-${missionId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_live_locations", filter: `mission_id=eq.${missionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const r = payload.new as LiveLocation;
          setLoc({ latitude: r.latitude, longitude: r.longitude, heading: r.heading, updated_at: r.updated_at });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [missionId, enabled]);
  return loc;
}
