import type { MissionCategory, MissionPriority } from "@/lib/towia";

/** Niveaux d'urgence affichés à l'utilisateur (mappés sur mission_priority). */
export const URGENCY_LABELS: Record<MissionPriority, string> = {
  NORMAL: "NORMAL",
  HIGH: "URGENT",
  EMERGENCY: "CRITIQUE",
};

export type SosMessage = { role: "assistant" | "user"; content: string };

export type SosCollected = {
  service_type: MissionCategory | null;
  urgency: MissionPriority;
  problem_description: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_registration: string | null;
  answers: Record<string, string>;
  safety_notice: string | null;
};

export type SosStep = {
  message: string;
  options: string[];
  allowFreeText: boolean;
  field: string | null;
  updates: Partial<SosCollected>;
  done: boolean;
};

export const EMPTY_COLLECTED: SosCollected = {
  service_type: null,
  urgency: "NORMAL",
  problem_description: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_year: null,
  vehicle_registration: null,
  answers: {},
  safety_notice: null,
};

/** Chronologie de suivi d'une mission (statuts réels de la base). */
export const MISSION_TIMELINE: { status: string; label: string }[] = [
  { status: "CREATED", label: "Demande envoyée" },
  { status: "SEARCHING", label: "Recherche d'un dépanneur" },
  { status: "PROPOSED", label: "Dépanneur trouvé" },
  { status: "ACCEPTED", label: "Mission acceptée" },
  { status: "EN_ROUTE", label: "Dépanneur en route" },
  { status: "ARRIVED", label: "Dépanneur arrivé" },
  { status: "IN_PROGRESS", label: "Intervention en cours" },
  { status: "COMPLETED", label: "Intervention terminée" },
];

export const TIMELINE_ORDER = MISSION_TIMELINE.map((s) => s.status);
