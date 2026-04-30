import { jsonError, verifySiweAndIssueSession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requestHost(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("host");
}

/**
 * Must match the SIWE message `domain` (client uses `window.location.host`).
 * Prefer explicit env in multi-tenant or non-standard proxy setups.
 */
function configuredSiweDomain(request: Request): string {
  const configured = process.env.SIWE_DOMAIN || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.includes("://") ? new URL(configured).host : configured;
  }

  const fromHeaders = requestHost(request);
  if (fromHeaders) return fromHeaders;

  try {
    return new URL(request.url).host;
  } catch {
    throw new Error(
      "SIWE_DOMAIN is not configured. Set SIWE_DOMAIN or NEXT_PUBLIC_APP_URL, or ensure Host / x-forwarded-host is set."
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  const signature = typeof body?.signature === "string" ? body.signature : "";

  if (!message || !signature) {
    return jsonError("Both message and signature are required.", 400);
  }

  try {
    const expectedDomain = configuredSiweDomain(request);
    const creator = await verifySiweAndIssueSession(message, signature as `0x${string}`, { expectedDomain });
    return Response.json({ creator });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return jsonError(status >= 500 ? "Authentication failed." : (error as Error).message, status);
  }
}
