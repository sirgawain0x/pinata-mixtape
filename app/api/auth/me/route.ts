import { getCurrentCreator } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const creator = await getCurrentCreator();
  return Response.json({ creator });
}
