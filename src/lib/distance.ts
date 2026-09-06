/**
 * TowIA — service de distance (structure évolutive).
 *
 * Par défaut la distance est calculée à vol d'oiseau (Haversine) à partir de
 * coordonnées RÉELLES. Si une position manque, la distance vaut `null` :
 * aucune distance n'est inventée.
 *
 * Pour brancher plus tard Google Maps / Mapbox : appeler
 * `registerDistanceProvider(async (from, to) => ({ km, source: "maps" }))`.
 */

export type Coords = { lat: number; lng: number };

export type DistanceResult = {
  /** Distance en kilomètres, ou null si elle ne peut pas être établie. */
  km: number | null;
  source: "haversine" | "maps" | "unknown";
};

export function haversineKm(from: Coords, to: Coords): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

export function toCoords(lat?: number | null, lng?: number | null): Coords | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export type DistanceProvider = (from: Coords, to: Coords) => Promise<DistanceResult>;

let provider: DistanceProvider | null = null;

/** Permet de brancher un fournisseur cartographique (Google Maps, Mapbox…). */
export function registerDistanceProvider(next: DistanceProvider | null): void {
  provider = next;
}

/** Distance entre deux positions réelles. Retourne `null` si indisponible. */
export async function computeDistanceKm(
  from: Coords | null,
  to: Coords | null,
): Promise<DistanceResult> {
  if (!from || !to) return { km: null, source: "unknown" };
  if (provider) {
    try {
      const result = await provider(from, to);
      if (result.km != null && Number.isFinite(result.km)) return result;
    } catch {
      // Repli sur le calcul local si le fournisseur échoue.
    }
  }
  return { km: haversineKm(from, to), source: "haversine" };
}

export function formatDistance(km: number | null | undefined): string {
  return km == null ? "Distance à confirmer" : `${Number(km).toFixed(1)} km`;
}
