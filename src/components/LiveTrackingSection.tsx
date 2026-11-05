import { lazy, Suspense, useCallback, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Clock, Route as RouteIcon, Truck } from "lucide-react";
import { Section } from "@/components/ui-kit";
import { useLiveLocation } from "@/lib/live-location";

const LiveTrackingMap = lazy(() => import("@/components/LiveTrackingMap"));

const STALE_MS = 30000;

export function LiveTrackingSection({
  missionId,
  client,
}: {
  missionId: string;
  client: { lat: number; lng: number };
}) {
  const live = useLiveLocation(missionId, true);
  const [route, setRoute] = useState<{ km: number; min: number; road: boolean } | null>(null);
  const onRoute = useCallback((r: typeof route) => setRoute(r), []);
  const updated = live ? new Date(live.updated_at) : null;
  const stale = updated ? Date.now() - updated.getTime() > STALE_MS : false;
  const eta = route ? new Date(Date.now() + route.min * 60000) : null;
  const fallback = <div className="h-72 w-full animate-pulse rounded-xl bg-muted sm:h-96" />;

  return (
    <Section title="Suivi du dépanneur en direct">
      <div className="space-y-3">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <LiveTrackingMap client={client} live={live} onRoute={onRoute} />
          </Suspense>
        </ClientOnly>
        {!live ? (
          <p className="text-sm text-muted-foreground">
            En attente de la position du dépanneur. Elle apparaîtra dès qu'il active le suivi.
          </p>
        ) : (
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p className="flex items-center gap-2">
              <RouteIcon className="size-4 text-primary" />
              {route ? `${route.km.toFixed(1)} km restants${route.road ? "" : " (à vol d'oiseau)"}` : "Calcul…"}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              {eta
                ? `Arrivée vers ${eta.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : "—"}
            </p>
            <p className="flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              {stale ? "Suivi interrompu" : "Position en direct"}
            </p>
          </div>
        )}
        {live && stale && updated ? (
          <p className="text-xs text-muted-foreground">
            Dernière position reçue le {updated.toLocaleDateString("fr-FR")} à{" "}
            {updated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        ) : null}
      </div>
    </Section>
  );
}
