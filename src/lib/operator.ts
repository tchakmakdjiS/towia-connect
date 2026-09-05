import { supabase } from "@/integrations/supabase/client";
import type { MissionStatus } from "@/lib/towia";
import type { TablesUpdate } from "@/integrations/supabase/types";

/** Étapes terrain du dépanneur (statuts réels de la base). */
export const OPERATOR_STEPS: Record<
  string,
  { next: MissionStatus; label: string; confirm?: string }
> = {
  ACCEPTED: { next: "EN_ROUTE", label: "JE PARS — EN ROUTE" },
  EN_ROUTE: { next: "ARRIVED", label: "JE SUIS ARRIVÉ", confirm: "Confirmer votre arrivée ?" },
  ARRIVED: { next: "IN_PROGRESS", label: "DÉMARRER L'INTERVENTION" },
};

export const STATUS_NOTIFICATIONS: Partial<
  Record<MissionStatus, { event: string; title: string; body: string }>
> = {
  ACCEPTED: {
    event: "OPERATOR_FOUND",
    title: "Votre dépanneur a accepté votre demande.",
    body: "Un professionnel prend en charge votre intervention.",
  },
  EN_ROUTE: {
    event: "OPERATOR_EN_ROUTE",
    title: "Votre dépanneur est en route.",
    body: "Il se dirige vers votre position.",
  },
  ARRIVED: {
    event: "OPERATOR_ARRIVED",
    title: "Votre dépanneur est arrivé sur place.",
    body: "Retrouvez-le auprès de votre véhicule.",
  },
  IN_PROGRESS: {
    event: "MISSION_IN_PROGRESS",
    title: "L'intervention a démarré.",
    body: "Votre dépanneur travaille sur votre véhicule.",
  },
  COMPLETED: {
    event: "MISSION_COMPLETED",
    title: "Intervention terminée.",
    body: "Vous pouvez laisser un avis sur votre dépanneur.",
  },
  CANCELLED: {
    event: "MISSION_CANCELLED",
    title: "Mission annulée.",
    body: "La recherche d'un autre professionnel peut être relancée.",
  },
};

export const STATUS_EVENT_LABELS: Partial<Record<MissionStatus, string>> = {
  ACCEPTED: "Mission acceptée par le dépanneur",
  EN_ROUTE: "Dépanneur en route",
  ARRIVED: "Dépanneur arrivé sur place",
  IN_PROGRESS: "Intervention en cours",
  COMPLETED: "Intervention terminée",
  SEARCHING: "Recherche d'un dépanneur",
};

/** Position GPS courante, sans jamais inventer de coordonnées. */
export async function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

export function haversineKm(
  a: { latitude?: number | null | undefined; longitude?: number | null | undefined },
  b: { latitude?: number | null | undefined; longitude?: number | null | undefined },
): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null)
    return null;
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Ouvre l'application de navigation du téléphone (Apple Plans sur iOS, Google Maps ailleurs). */
export function navigationUrl(
  latitude?: number | null,
  longitude?: number | null,
  address?: string | null,
): string | null {
  const isApple =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  if (latitude != null && longitude != null) {
    return isApple
      ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
  if (address) {
    const q = encodeURIComponent(address);
    return isApple ? `https://maps.apple.com/?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }
  return null;
}

export async function notifyMissionUser(params: {
  userId: string;
  missionId: string;
  status: MissionStatus;
}) {
  const n = STATUS_NOTIFICATIONS[params.status];
  if (!n) return;
  await supabase.from("notifications").insert({
    user_id: params.userId,
    mission_id: params.missionId,
    event: n.event,
    title: n.title,
    body: n.body,
  });
}

/** Enchaînements de statuts autorisés (miroir de la règle appliquée en base). */
export const ALLOWED_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  CREATED: ["AI_ANALYSIS", "SEARCHING", "CANCELLED"],
  AI_ANALYSIS: ["SEARCHING", "CANCELLED"],
  SEARCHING: ["PROPOSED", "ACCEPTED", "CANCELLED"],
  PROPOSED: ["ACCEPTED", "SEARCHING", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "DISPUTED", "CANCELLED"],
  COMPLETED: ["DISPUTED"],
  CANCELLED: [],
  DISPUTED: ["COMPLETED", "CANCELLED"],
};

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** Complète l'événement créé automatiquement en base avec la position du dépanneur. */
async function attachPositionToLastEvent(missionId: string, status: MissionStatus) {
  const pos = await currentPosition();
  if (!pos) return;
  const { data } = await supabase
    .from("mission_events")
    .select("id")
    .eq("mission_id", missionId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from("mission_events")
    .update({ latitude: pos.latitude, longitude: pos.longitude })
    .eq("id", data.id);
}

/**
 * Change le statut d'une mission. La base journalise automatiquement
 * l'événement (date, auteur, mission) ; le client est ensuite notifié.
 */
export async function advanceMissionStatus(params: {
  missionId: string;
  clientId: string;
  actorId: string;
  previous: MissionStatus;
  next: MissionStatus;
  extra?: Partial<TablesUpdate<"missions">>;
}): Promise<string | null> {
  if (!canTransition(params.previous, params.next)) {
    return "Cette étape n'est pas possible depuis le statut actuel de la mission.";
  }
  const now = new Date().toISOString();
  const patch: TablesUpdate<"missions"> = {
    status: params.next,
    ...(params.next === "EN_ROUTE" ? { departure_time: now } : {}),
    ...(params.next === "ARRIVED" ? { arrival_at: now } : {}),
    ...(params.next === "COMPLETED" ? { completed_at: now } : {}),
    ...(params.extra ?? {}),
  };
  const { error } = await supabase.from("missions").update(patch).eq("id", params.missionId);
  if (error) return error.message;

  await attachPositionToLastEvent(params.missionId, params.next);
  await notifyMissionUser({
    userId: params.clientId,
    missionId: params.missionId,
    status: params.next,
  });
  return null;
}

export type PeriodFilter = "today" | "week" | "month" | "all";

export const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "all", label: "Toutes" },
];

export function periodStart(period: PeriodFilter): Date | null {
  const now = new Date();
  if (period === "all") return null;
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const day = (now.getDay() + 6) % 7; // lundi = 0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  return monday;
}

export function inPeriod(dateValue: string | null | undefined, period: PeriodFilter): boolean {
  if (period === "all") return true;
  if (!dateValue) return false;
  const start = periodStart(period);
  return !!start && new Date(dateValue) >= start;
}

/** Le dépanneur accepte une proposition : la mission lui est attribuée. */
export async function acceptOffer(params: {
  offerId: string;
  missionId: string;
  operatorId: string;
  companyId?: string | null;
  actorId: string;
  clientId: string;
}): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("missions")
    .update({
      status: "ACCEPTED",
      operator_id: params.operatorId,
      accepted_at: now,
      ...(params.companyId ? { company_id: params.companyId } : {}),
    })
    .eq("id", params.missionId);
  if (error) return error.message;

  await supabase
    .from("mission_offers")
    .update({ status: "ACCEPTED", responded_at: now })
    .eq("id", params.offerId);
  await supabase
    .from("mission_offers")
    .update({ status: "CANCELLED", responded_at: now })
    .eq("mission_id", params.missionId)
    .neq("id", params.offerId)
    .eq("status", "PENDING");

  await attachPositionToLastEvent(params.missionId, "ACCEPTED");
  await notifyMissionUser({
    userId: params.clientId,
    missionId: params.missionId,
    status: "ACCEPTED",
  });
  return null;
}

/** Le dépanneur refuse : la mission repart en recherche pour un autre professionnel. */
export async function declineOffer(params: {
  offerId: string;
  missionId: string;
  actorId: string;
}): Promise<string | null> {
  const now = new Date().toISOString();
  const { error: missionError } = await supabase
    .from("missions")
    .update({ status: "SEARCHING" })
    .eq("id", params.missionId)
    .neq("status", "ACCEPTED");
  if (missionError) return missionError.message;

  const { error } = await supabase
    .from("mission_offers")
    .update({ status: "DECLINED", responded_at: now })
    .eq("id", params.offerId);
  if (error) return error.message;

  await supabase.from("mission_events").insert({
    mission_id: params.missionId,
    status: "SEARCHING",
    previous_status: "PROPOSED",
    label: "Proposition refusée par un dépanneur",
    actor_id: params.actorId,
  });
  return null;
}
