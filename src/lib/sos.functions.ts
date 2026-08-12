import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { rankCandidates } from "@/lib/dispatch";
import type { SosCollected, SosStep } from "@/lib/sos";
import type { MissionCategory } from "@/lib/towia";

const SYSTEM_PROMPT = `Tu es TowIA, un assistant francophone spécialisé dans l'assistance automobile d'urgence.
Tu mènes un questionnaire conversationnel, UNE SEULE question à la fois, en français, ton calme et rassurant, phrases courtes.

Objectif : collecter les informations nécessaires pour envoyer un dépanneur.
Ordre recommandé :
1. Type de problème (service_type) s'il n'est pas connu.
2. Sécurité de la personne ("Êtes-vous actuellement en sécurité ?").
3. Le véhicule peut-il encore rouler ?
4. Véhicule : marque, modèle, année (facultative), immatriculation (facultative).
5. Questions adaptatives selon le type de panne :
   - ACCIDENT : blessés ? véhicule bloque la circulation ? peut-il rouler ? où se trouve le véhicule ?
   - BATTERIE : le véhicule démarre-t-il ? voyants allumés ? batterie 12V ou véhicule électrique/hybride ?
   - CREVAISON : roue endommagée ? véhicule immobilisé ? roue de secours ?
   - PANNE : symptômes, voyant moteur, bruit inhabituel, fumée, moteur démarre, peut rouler.
   - CLES_ENFERMEES : clés enfermées dans le véhicule ? véhicule verrouillé ?
   - FUMEE_DANGER : PRIORITÉ SÉCURITÉ. Dis immédiatement "Éloignez-vous du véhicule et mettez-vous en sécurité." et si nécessaire "Contactez les services d'urgence (112)." Ne demande jamais de rester près du véhicule.
   - ERREUR_CARBURANT : quel carburant a été mis ? moteur démarré depuis ?
6. Une courte description libre du problème si elle manque.

Niveau d'urgence (urgency) : NORMAL, HIGH (urgent) ou EMERGENCY (critique).
EMERGENCY si : danger immédiat, blessé, véhicule en position dangereuse, fumée/incendie, risque pour les personnes.

Règles :
- Ne jamais inventer de prix, de délai, de disponibilité ou de diagnostic certain.
- Ne jamais poser deux questions dans le même message.
- Quand toutes les informations essentielles sont réunies (type, sécurité, véhicule roulant, marque/modèle, description), mets done = true.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "message": "ta question ou ton message",
  "options": ["Oui", "Non"],
  "allow_free_text": true,
  "field": "identifiant_court_de_la_question",
  "updates": {
    "service_type": "PANNE|REMORQUAGE|BATTERIE|CREVAISON|ERREUR_CARBURANT|ACCIDENT|VEHICULE_ELECTRIQUE|CLES_ENFERMEES|FUMEE_DANGER|AUTRE",
    "urgency": "NORMAL|HIGH|EMERGENCY",
    "problem_description": "...",
    "vehicle_make": "...",
    "vehicle_model": "...",
    "vehicle_year": 2015,
    "vehicle_registration": "...",
    "safety_notice": "message de sécurité si danger",
    "answers": { "cle": "valeur" }
  },
  "done": false
}
N'inclus dans "updates" que les champs réellement déduits du dernier échange.`;

const CATEGORIES: MissionCategory[] = [
  "PANNE",
  "REMORQUAGE",
  "BATTERIE",
  "CREVAISON",
  "ERREUR_CARBURANT",
  "ACCIDENT",
  "VEHICULE_ELECTRIQUE",
  "CLES_ENFERMEES",
  "FUMEE_DANGER",
  "AUTRE",
];

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizeStep(raw: Record<string, unknown>): SosStep {
  const rawUpdates = (raw["updates"] ?? {}) as Record<string, unknown>;
  const updates: Partial<SosCollected> = {};

  const service = rawUpdates["service_type"];
  if (typeof service === "string" && CATEGORIES.includes(service as MissionCategory)) {
    updates.service_type = service as MissionCategory;
  }
  const urgency = rawUpdates["urgency"];
  if (urgency === "NORMAL" || urgency === "HIGH" || urgency === "EMERGENCY") {
    updates.urgency = urgency;
  }
  for (const key of [
    "problem_description",
    "vehicle_make",
    "vehicle_model",
    "vehicle_registration",
    "safety_notice",
  ] as const) {
    const value = rawUpdates[key];
    if (typeof value === "string" && value.trim()) updates[key] = value.trim();
  }
  const year = rawUpdates["vehicle_year"];
  if (typeof year === "number" && Number.isFinite(year)) updates.vehicle_year = Math.trunc(year);
  if (typeof year === "string" && /^\d{4}$/.test(year)) updates.vehicle_year = Number(year);

  const answers = rawUpdates["answers"];
  if (answers && typeof answers === "object") {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number") clean[k] = String(v);
    }
    if (Object.keys(clean).length > 0) updates.answers = clean;
  }

  const options = Array.isArray(raw["options"])
    ? (raw["options"] as unknown[]).filter((o): o is string => typeof o === "string").slice(0, 6)
    : [];

  return {
    message: typeof raw["message"] === "string" ? raw["message"] : "Pouvez-vous préciser ?",
    options,
    allowFreeText: raw["allow_free_text"] !== false,
    field: typeof raw["field"] === "string" ? raw["field"] : null,
    updates,
    done: raw["done"] === true,
  };
}

/** Étape suivante du questionnaire IA (une question à la fois). */
export const sosNextStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { messages: { role: "assistant" | "user"; content: string }[]; collected: SosCollected }) =>
      input,
  )
  .handler(async ({ data }): Promise<SosStep> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Assistant IA indisponible");

    const gateway = createLovableAiGatewayProvider(key);
    const history = data.messages
      .slice(-20)
      .map((m) => `${m.role === "user" ? "Utilisateur" : "TowIA"}: ${m.content}`)
      .join("\n");

    const result = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      system: SYSTEM_PROMPT,
      prompt: `Informations déjà collectées (JSON) :\n${JSON.stringify(data.collected)}\n\nConversation :\n${history || "(aucune)"}\n\nDonne l'étape suivante au format JSON demandé.`,
    });

    const parsed = extractJson(result.text);
    if (!parsed) {
      return {
        message: "Pouvez-vous décrire précisément ce qui se passe ?",
        options: [],
        allowFreeText: true,
        field: "description",
        updates: {},
        done: false,
      };
    }
    return sanitizeStep(parsed);
  });

export type DispatchResult = { offers: number };

/** Recherche des dépanneurs compatibles et crée les propositions de mission. */
export const dispatchMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { missionId: string }) => input)
  .handler(async ({ data, context }): Promise<DispatchResult> => {
    const { supabase, userId } = context;

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("*")
      .eq("id", data.missionId)
      .maybeSingle();
    if (missionError) throw new Error(missionError.message);
    if (!mission || mission.client_id !== userId) throw new Error("Mission introuvable");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: operators, error: operatorsError } = await supabaseAdmin
      .from("operators")
      .select(
        "id, services, equipment, rating, intervention_zone, is_available, availability, verification, last_latitude, last_longitude, service_radius_km",
      )
      .eq("verification", "VERIFIED");
    if (operatorsError) throw new Error(operatorsError.message);

    const toRad = (v: number) => (v * Math.PI) / 180;
    const distanceKm = (aLat: number, aLon: number, bLat: number, bLon: number) => {
      const dLat = toRad(bLat - aLat);
      const dLon = toRad(bLon - aLon);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(h));
    };

    const candidates = (operators ?? [])
      .filter((o) => o.availability !== "UNAVAILABLE")
      .map((o) => {
        const d =
          mission.latitude != null &&
          mission.longitude != null &&
          o.last_latitude != null &&
          o.last_longitude != null
            ? distanceKm(mission.latitude, mission.longitude, o.last_latitude, o.last_longitude)
            : null;
        return {
          operatorId: o.id,
          isAvailable: o.is_available === true || o.availability === "AVAILABLE",
          distanceKm: d,
          estimatedMinutes: d == null ? null : Math.round(d * 1.6 + 5),
          rating: o.rating,
          services: o.services,
          equipment: o.equipment,
          interventionZone: o.intervention_zone,
          radiusKm: o.service_radius_km,
        };
      })
      .filter((c) => c.distanceKm == null || !c.radiusKm || c.distanceKm <= c.radiusKm);

    const ranked = rankCandidates(candidates, {
      category: mission.category,
      requiredServices: [mission.category],
      zone: mission.city ?? null,
    }).slice(0, 5);

    if (ranked.length > 0) {
      const byId = new Map(candidates.map((c) => [c.operatorId, c]));
      const { error: offerError } = await supabaseAdmin.from("mission_offers").insert(
        ranked.map((r) => {
          const c = byId.get(r.operatorId);
          return {
            mission_id: mission.id,
            operator_id: r.operatorId,
            score: r.score,
            distance_km: c?.distanceKm ?? null,
            estimated_arrival:
              c?.estimatedMinutes != null
                ? new Date(Date.now() + c.estimatedMinutes * 60_000).toISOString()
                : null,
            status: "PENDING" as const,
            expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          };
        }),
      );
      if (offerError) throw new Error(offerError.message);

      await supabaseAdmin.from("missions").update({ status: "PROPOSED" }).eq("id", mission.id);
      await supabaseAdmin.from("mission_events").insert({
        mission_id: mission.id,
        status: "PROPOSED",
        label: `Mission proposée à ${ranked.length} professionnel(s)`,
      });
    }

    return { offers: ranked.length };
  });
