import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveLocation } from "@/lib/live-location";
import { haversineKm } from "@/lib/distance";

type Route = { coords: [number, number][]; km: number; min: number } | null;

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="width:40px;height:40px;border-radius:50%;background:#F47B20;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:20px">🚚</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});
const clientIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#222;border:4px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

async function fetchRoute(from: [number, number], to: [number, number]): Promise<Route> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json.routes?.[0];
    if (!r) return null;
    return {
      coords: r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
      km: r.distance / 1000,
      min: r.duration / 60,
    };
  } catch {
    return null;
  }
}

export default function LiveTrackingMap({
  client,
  live,
  onRoute,
}: {
  client: { lat: number; lng: number };
  live: LiveLocation | null;
  onRoute: (info: { km: number; min: number; road: boolean } | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const truck = useRef<L.Marker | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const lastRouteAt = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const [fitted, setFitted] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([client.lat, client.lng], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    L.marker([client.lat, client.lng], { icon: clientIcon }).addTo(m).bindTooltip("Vous");
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      truck.current = null;
      line.current = null;
    };
  }, [client.lat, client.lng]);

  useEffect(() => {
    const m = map.current;
    if (!m || !live) return;
    const target: [number, number] = [live.latitude, live.longitude];
    if (!truck.current) {
      truck.current = L.marker(target, { icon: truckIcon }).addTo(m).bindTooltip("Dépanneur");
    } else {
      // Animation douce vers la nouvelle position
      const start = truck.current.getLatLng();
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 1000);
        truck.current?.setLatLng([
          start.lat + (target[0] - start.lat) * k,
          start.lng + (target[1] - start.lng) * k,
        ]);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    if (!fitted) {
      m.fitBounds(L.latLngBounds([target, [client.lat, client.lng]]).pad(0.3));
      setFitted(true);
    }

    // Itinéraire : recalculé au plus toutes les 20 s ou après 100 m
    const prev = lastRouteAt.current;
    const moved = prev ? haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: target[0], lng: target[1] }) * 1000 : Infinity;
    if (prev && Date.now() - prev.at < 20000 && moved < 100) return;
    lastRouteAt.current = { at: Date.now(), lat: target[0], lng: target[1] };
    void fetchRoute(target, [client.lat, client.lng]).then((r) => {
      if (!map.current) return;
      const coords = r?.coords ?? [target, [client.lat, client.lng]];
      if (line.current) line.current.setLatLngs(coords);
      else
        line.current = L.polyline(coords, {
          color: "#F47B20",
          weight: 5,
          opacity: 0.85,
          dashArray: r ? undefined : "8 8",
        }).addTo(map.current);
      if (r) onRoute({ km: r.km, min: r.min, road: true });
      else {
        const km = haversineKm({ lat: target[0], lng: target[1] }, client);
        onRoute({ km, min: (km / 40) * 60, road: false });
      }
    });
  }, [live, client, fitted, onRoute]);

  return <div ref={el} className="h-72 w-full overflow-hidden rounded-xl border border-border sm:h-96" />;
}
