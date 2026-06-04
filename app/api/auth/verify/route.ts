import { jsonError, verifySiweAndIssueSession } from "../../../../lib/auth";
import { parseSiweMessage } from "viem/siwe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIWE_SIGNATURE_HEX = /^0x[0-9a-fA-F]+$/;
/** Min: 0x + 128 hex (64-byte compact). Max: generous cap for ERC-6492-wrapped signatures. */
const SIWE_SIGNATURE_MIN_LEN = 130;
const SIWE_SIGNATURE_MAX_LEN = 8192;

function parseSiweSignatureHex(signature: string): `0x${string}` | null {
  if (
    !SIWE_SIGNATURE_HEX.test(signature) ||
    (signature.length - 2) % 2 !== 0 ||
    signature.length < SIWE_SIGNATURE_MIN_LEN ||
    signature.length > SIWE_SIGNATURE_MAX_LEN
  ) {
    return null;
  }
  return signature as `0x${string}`;
}

function hostFromEnvValue(value: string): string {
  return value.includes("://") ? new URL(value).host : value;
}

function requestHost(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("host");
}

/**
 * Resolves the SIWE domain the server expects. Must match the message `domain`
 * (client uses `window.location.host` or `NEXT_PUBLIC_SIWE_DOMAIN`).
 */
function resolveExpectedSiweDomain(request: Request, messageDomain: string): string {
  const explicit = process.env.SIWE_DOMAIN?.trim();
  if (explicit) return hostFromEnvValue(explicit);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const appHost = hostFromEnvValue(appUrl);
    if (appHost === messageDomain) return appHost;
  }

  const fromHeaders = requestHost(request);
  if (fromHeaders) return fromHeaders;

  return new URL(request.url).host;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  const signature = typeof body?.signature === "string" ? body.signature : "";

  if (!message || !signature) {
    return jsonError("Both message and signature are required.", 400);
  }

  const signatureHex = parseSiweSignatureHex(signature);
  if (!signatureHex) {
    return jsonError("Invalid signature format.", 400);
  }

  const fields = parseSiweMessage(message);
  const messageDomain = fields.domain?.trim();
  if (!messageDomain) {
    return jsonError("Invalid SIWE message: missing domain.", 400);
  }

  const expectedDomain = resolveExpectedSiweDomain(request, messageDomain);
  if (messageDomain !== expectedDomain) {
    return jsonError(
      `SIWE domain mismatch: expected ${expectedDomain}, got ${messageDomain}.`,
      401
    );
  }

  try {
    const creator = await verifySiweAndIssueSession(message, signatureHex, { expectedDomain });
    return Response.json({ creator });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return jsonError(status >= 500 ? "Authentication failed." : (error as Error).message, status);
  }
}
