import { withCreator } from "../../../../lib/auth";
import { deleteStation, getStation, updateStation } from "../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function stationId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

export async function GET(_request: Request, context: Context) {
  const station = getStation(await stationId(context));
  if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
  return Response.json({ station });
}

export async function PATCH(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const id = await stationId(context);
    const station = getStation(id);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    const body = await request.json().catch(() => null);
    const updated = updateStation(id, body ?? {});
    return Response.json({ station: updated });
  });
}

export async function DELETE(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const id = await stationId(context);
    const station = getStation(id);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    deleteStation(id);
    return Response.json({ ok: true });
  });
}
