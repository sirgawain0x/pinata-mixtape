import { jsonError, verifySiweAndIssueSession } from "../../../../lib/auth";

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

/**
 * Must match the SIWE message `domain` (client uses `window.location.host`).
 * Set SIWE_DOMAIN or NEXT_PUBLIC_APP_URL — never derived from request headers or URL.
 */
function configuredSiweDomain(): string {
  const configured = process.env.SIWE_DOMAIN || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.includes("://") ? new URL(configured).host : configured;
  }
  throw new Error(
    "SIWE_DOMAIN is not configured. Set SIWE_DOMAIN or NEXT_PUBLIC_APP_URL."
  );
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

  try {
    const expectedDomain = configuredSiweDomain();
    const creator = await verifySiweAndIssueSession(message, signatureHex, { expectedDomain });
    return Response.json({ creator });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return jsonError(status >= 500 ? "Authentication failed." : (error as Error).message, status);
  }
}
