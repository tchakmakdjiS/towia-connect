import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Provider AI SDK connecté à la passerelle IA Lovable (clé côté serveur uniquement). */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}
