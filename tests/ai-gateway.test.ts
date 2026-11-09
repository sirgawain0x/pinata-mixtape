import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { AI_GATEWAY_ENV, isAiGatewayConfigured, resolveAiGatewayModel } from "../lib/ai-gateway";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

test("documents AI Gateway env var names used by this app", () => {
  assert.deepEqual(AI_GATEWAY_ENV, {
    apiKey: "AI_GATEWAY_API_KEY",
    model: "AI_GATEWAY_MODEL",
    vercelOidcToken: "VERCEL_OIDC_TOKEN",
  });
});

test("Vercel deployments may use OIDC without AI_GATEWAY_API_KEY or project VERCEL_OIDC_TOKEN", () => {
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  process.env.VERCEL = "1";
  assert.equal(isAiGatewayConfigured(), true);
});

test("local dev requires an explicit Gateway credential", () => {
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.VERCEL;
  assert.equal(isAiGatewayConfigured(), false);
  process.env.AI_GATEWAY_API_KEY = "test-key";
  assert.equal(isAiGatewayConfigured(), true);
});

test("resolveAiGatewayModel uses AI_GATEWAY_MODEL when set", () => {
  delete process.env.AI_GATEWAY_MODEL;
  assert.equal(resolveAiGatewayModel(), "google/gemini-3.8-flash");
  process.env.AI_GATEWAY_MODEL = "anthropic/claude-sonnet-4.5";
  assert.equal(resolveAiGatewayModel(), "anthropic/claude-sonnet-4.5");
});
