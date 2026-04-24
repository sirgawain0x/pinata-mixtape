import { withCreator } from "../../../../../../lib/auth";
import { getStation, reorderSegments } from "../../../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const stationId = Number(params.id);
    const station = getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((value: unknown) => Number.isFinite(value)).map((value: number) => Number(value))
      : [];
    const segments = reorderSegments(stationId, ids);
    return Response.json({ segments });
  });
}
