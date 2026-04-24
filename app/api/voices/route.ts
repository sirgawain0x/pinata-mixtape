import { listAvailableVoices } from "../../../lib/tts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = await listAvailableVoices();
  return Response.json(data);
}
