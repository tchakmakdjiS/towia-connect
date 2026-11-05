import { MapPinned, WifiOff } from "lucide-react";
import { Section } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useLiveLocationSharing } from "@/lib/live-location";

export function LiveSharingPanel(props: { missionId: string; operatorId: string; status: string }) {
  const { state, lastSentAt, start, stop } = useLiveLocationSharing(props);
  const on = state === "active" || state === "starting" || state === "offline";
  return (
    <Section title="Suivi GPS" description="Le client voit votre position pendant le trajet.">
      <div className="space-y-3">
        {on ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            {state === "offline" ? (
              <WifiOff className="size-4 text-warning" />
            ) : (
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-primary" />
              </span>
            )}
            <span className="font-medium">
              {state === "starting"
                ? "Recherche du signal GPS…"
                : state === "offline"
                  ? "Connexion perdue — reprise automatique"
                  : "Position partagée"}
            </span>
            {lastSentAt ? (
              <span className="ml-auto text-xs text-muted-foreground">
                Envoi {lastSentAt.toLocaleTimeString("fr-FR")}
              </span>
            ) : null}
          </div>
        ) : null}
        {state === "denied" ? (
          <p className="text-sm text-destructive">
            Accès à la position refusé. Autorisez la localisation pour TowIA dans les réglages du téléphone ou du navigateur.
          </p>
        ) : null}
        {state === "unavailable" ? (
          <p className="text-sm text-destructive">Position indisponible pour le moment. Vérifiez que le GPS est activé.</p>
        ) : null}
        {on ? (
          <Button variant="secondary" className="h-12 w-full rounded-2xl" onClick={stop}>
            Arrêter le suivi GPS
          </Button>
        ) : (
          <Button className="h-14 w-full rounded-2xl font-semibold" onClick={start}>
            <MapPinned className="mr-2 size-5" /> Démarrer le suivi GPS
          </Button>
        )}
      </div>
    </Section>
  );
}
