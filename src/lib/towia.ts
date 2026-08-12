/**
 * TowIA domain model helpers.
 * No fictional data, no invented prices, no invented GPS positions.
 */

export type AppRole = "customer" | "tow_operator" | "company" | "admin";

export type MissionStatus =
  | "CREATED"
  | "AI_ANALYSIS"
  | "SEARCHING"
  | "PROPOSED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type MissionPriority = "NORMAL" | "HIGH" | "EMERGENCY";

export type MissionCategory =
  | "PANNE"
  | "REMORQUAGE"
  | "BATTERIE"
  | "CREVAISON"
  | "ERREUR_CARBURANT"
  | "ACCIDENT"
  | "VEHICULE_ELECTRIQUE"
  | "CLES_ENFERMEES"
  | "FUMEE_DANGER"
  | "AUTRE";


export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  CREATED: "Créée",
  AI_ANALYSIS: "Analyse IA",
  SEARCHING: "Recherche d'un dépanneur",
  PROPOSED: "Proposée",
  ACCEPTED: "Acceptée",
  EN_ROUTE: "En route",
  ARRIVED: "Sur place",
  IN_PROGRESS: "Intervention en cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  DISPUTED: "Litige",
};

export const MISSION_PRIORITY_LABELS: Record<MissionPriority, string> = {
  NORMAL: "Normale",
  HIGH: "Élevée",
  EMERGENCY: "Urgence",
};

export const MISSION_CATEGORIES: { value: MissionCategory; label: string; icon: string }[] = [
  { value: "PANNE", label: "Panne mécanique", icon: "AlertTriangle" },
  { value: "BATTERIE", label: "Batterie", icon: "BatteryWarning" },
  { value: "CREVAISON", label: "Crevaison", icon: "CircleDot" },
  { value: "CLES_ENFERMEES", label: "Clés enfermées", icon: "KeyRound" },
  { value: "ERREUR_CARBURANT", label: "Panne de carburant", icon: "Fuel" },
  { value: "ACCIDENT", label: "Accident", icon: "CarFront" },
  { value: "FUMEE_DANGER", label: "Fumée / danger", icon: "Flame" },
  { value: "REMORQUAGE", label: "Remorquage", icon: "Truck" },
  { value: "VEHICULE_ELECTRIQUE", label: "Véhicule électrique", icon: "Zap" },
  { value: "AUTRE", label: "Autre", icon: "HelpCircle" },
];


export const CATEGORY_LABELS = Object.fromEntries(
  MISSION_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<MissionCategory, string>;

export const ACTIVE_STATUSES: MissionStatus[] = [
  "CREATED",
  "AI_ANALYSIS",
  "SEARCHING",
  "PROPOSED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
];

/** Commission de démonstration. Taux non définitif, configurable côté plateforme. */
export const DEMO_COMMISSION_RATE = 0.1;

export function splitAmount(amount: number, rate = DEMO_COMMISSION_RATE) {
  const platformFee = Math.round(amount * rate * 100) / 100;
  return { platformFee, professionalAmount: Math.round((amount - platformFee) * 100) / 100 };
}

export const REVIEW_CRITERIA = [
  { key: "punctuality", label: "Ponctualité" },
  { key: "professionalism", label: "Professionnalisme" },
  { key: "speed", label: "Rapidité" },
  { key: "quality", label: "Qualité" },
  { key: "communication", label: "Communication" },
] as const;

export const NOTIFICATION_EVENTS = [
  "MISSION_CREATED",
  "OPERATOR_FOUND",
  "OPERATOR_EN_ROUTE",
  "OPERATOR_ARRIVED",
  "MISSION_COMPLETED",
  "PAYMENT_CONFIRMED",
  "REVIEW_REQUESTED",
] as const;

export function roleHome(role: AppRole | null): string {
  switch (role) {
    case "tow_operator":
      return "/depanneur/dashboard";
    case "company":
      return "/entreprise/dashboard";
    case "admin":
      return "/admin";
    default:
      return "/client/dashboard";
  }
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAmount(value?: number | null, currency = "EUR") {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  customer: "Automobiliste",
  tow_operator: "Dépanneur",
  company: "Entreprise",
  admin: "Administrateur",
};

/** Préfixe d'espace privé par rôle. */
export const ROLE_SECTION: Record<AppRole, string> = {
  customer: "/client",
  tow_operator: "/depanneur",
  company: "/entreprise",
  admin: "/admin",
};

export function profilePath(role: AppRole | null): string {
  switch (role) {
    case "tow_operator":
      return "/depanneur/profil";
    case "company":
      return "/entreprise/profil";
    case "admin":
      return "/admin/settings";
    default:
      return "/client/profil";
  }
}

/** Rôle requis pour un chemin privé donné, null si le chemin est public. */
export function requiredRoleForPath(pathname: string): AppRole | null {
  if (pathname.startsWith("/client")) return "customer";
  if (pathname.startsWith("/depanneur")) return "tow_operator";
  if (pathname.startsWith("/entreprise")) return "company";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}
