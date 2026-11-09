/** Env names read for the playlist assistant / AI Gateway (see also AI SDK @ai-sdk/gateway). */
export const AI_GATEWAY_ENV = {
  apiKey: "AI_GATEWAY_API_KEY",
  model: "AI_GATEWAY_MODEL",
  /** Used by create-playlist preflight; AI SDK also resolves OIDC via @vercel/oidc at request time. */
  vercelOidcToken: "VERCEL_OIDC_TOKEN",
} as const;

export function resolveAiGatewayModel(): string {
  return process.env.AI_GATEWAY_MODEL?.trim() || "google/gemini-3.8-flash";
}

/**
 * Whether the assistant route should attempt a Gateway call.
 * On Vercel, OIDC may arrive on the request header even when VERCEL_OIDC_TOKEN is unset in project env.
 */
export function isAiGatewayConfigured(): boolean {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return true;
  if (process.env.VERCEL_OIDC_TOKEN?.trim()) return true;
  if (process.env.VERCEL === "1") return true;
  return false;
}
