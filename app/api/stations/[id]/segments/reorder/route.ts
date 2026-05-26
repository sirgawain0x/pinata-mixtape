import { withCreator } from "../../../../../../lib/auth";
import { getStation, reorderSegments } from "../../../../../../lib/stations";
import { parsePositiveInteger } from "../../../../../../lib/outbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const stationId = parsePositiveInteger(params.id);
    if (stationId === null) {
      return Response.json({ error: "Invalid station id." }, { status: 400 });
    }
    const station = await getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isSafeInteger(value) && value > 0)
      : [];
    const segments = await reorderSegments(stationId, ids);
    return Response.json({ segments });
  });
}
