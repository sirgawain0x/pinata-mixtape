import { issueNonceStorage, purgeExpiredNoncesStorage } from "../../../../lib/auth-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await purgeExpiredNoncesStorage();
  const nonce = await issueNonceStorage();
  return Response.json({ nonce });
}
