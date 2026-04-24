import { jsonError, verifySiweAndIssueSession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  const signature = typeof body?.signature === "string" ? body.signature : "";

  if (!message || !signature) {
    return jsonError("Both message and signature are required.", 400);
  }

  const url = new URL(request.url);
  const expectedDomain = request.headers.get("host") || url.host;

  try {
    const creator = await verifySiweAndIssueSession(message, signature as `0x${string}`, { expectedDomain });
    return Response.json({ creator });
  } catch (error) {
    return jsonError((error as Error).message, 401);
  }
}
