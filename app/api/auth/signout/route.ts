import { clearSessionCookie, getSessionToken, revokeSession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const token = await getSessionToken();
  if (token) revokeSession(token);
  await clearSessionCookie();
  return Response.json({ ok: true });
}
