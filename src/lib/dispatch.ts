import type { MissionCategory } from "@/lib/towia";

/**
 * Moteur de dispatch TowIA (structure évolutive).
 *
 * Le score est calculé uniquement à partir de données réelles fournies en entrée.
 * Aucune distance, disponibilité ou position n'est inventée : lorsque la donnée
 * est absente, le critère est simplement neutralisé.
 */
export type DispatchCandidate = {
  operatorId: string;
  isAvailable: boolean;
  distanceKm?: number | null;
  estimatedMinutes?: number | null;
  rating?: number | null;
  services?: string[] | null;
  equipment?: string[] | null;
  interventionZone?: string | null;
};

export type DispatchRequest = {
  category: MissionCategory;
  requiredServices?: string[];
  requiredEquipment?: string[];
  zone?: string | null;
};

export type DispatchScore = {
  operatorId: string;
  score: number;
  reasons: string[];
};

const WEIGHTS = {
  availability: 30,
  distance: 25,
  eta: 15,
  services: 12,
  equipment: 8,
  zone: 5,
  quality: 5,
};

export function scoreCandidate(
  candidate: DispatchCandidate,
  request: DispatchRequest,
): DispatchScore {
  const reasons: string[] = [];
  let score = 0;

  if (candidate.isAvailable) {
    score += WEIGHTS.availability;
    reasons.push("Disponible");
  }

  if (typeof candidate.distanceKm === "number") {
    const proximity = Math.max(0, 1 - Math.min(candidate.distanceKm, 60) / 60);
    score += proximity * WEIGHTS.distance;
    reasons.push(`Distance ${candidate.distanceKm.toFixed(1)} km`);
  }

  if (typeof candidate.estimatedMinutes === "number") {
    const speed = Math.max(0, 1 - Math.min(candidate.estimatedMinutes, 120) / 120);
    score += speed * WEIGHTS.eta;
  }

  const services = candidate.services ?? [];
  const required = request.requiredServices ?? [];
  if (required.length > 0) {
    const covered = required.filter((s) => services.includes(s)).length / required.length;
    score += covered * WEIGHTS.services;
  }

  const equipment = candidate.equipment ?? [];
  const requiredEquipment = request.requiredEquipment ?? [];
  if (requiredEquipment.length > 0) {
    const covered =
      requiredEquipment.filter((e) => equipment.includes(e)).length / requiredEquipment.length;
    score += covered * WEIGHTS.equipment;
  }

  if (request.zone && candidate.interventionZone === request.zone) {
    score += WEIGHTS.zone;
    reasons.push("Zone couverte");
  }

  if (typeof candidate.rating === "number") {
    score += (candidate.rating / 5) * WEIGHTS.quality;
  }

  return { operatorId: candidate.operatorId, score: Math.round(score * 100) / 100, reasons };
}

export function rankCandidates(
  candidates: DispatchCandidate[],
  request: DispatchRequest,
): DispatchScore[] {
  return candidates.map((c) => scoreCandidate(c, request)).sort((a, b) => b.score - a.score);
}
