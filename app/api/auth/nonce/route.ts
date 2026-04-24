import { issueNonce, purgeExpiredNonces } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  purgeExpiredNonces();
  const nonce = issueNonce();
  return Response.json({ nonce });
}
