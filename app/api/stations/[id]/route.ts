import { getCurrentCreator, withCreator } from "../../../../lib/auth";
import { deleteStation, getStation, updateStation } from "../../../../lib/stations";
import { parsePositiveInteger } from "../../../../lib/outbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function stationId(context: Context): Promise<number> {
  const params = await context.params;
  const id = parsePositiveInteger(params.id);
  if (id === null) throw new Error("Invalid station id.");
  return id;
}

export async function GET(_request: Request, context: Context) {
  const station = getStation(await stationId(context));
  if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
  if (!station.isPublic) {
    const creator = await getCurrentCreator();
    if (creator?.id !== station.creatorId) {
      return Response.json({ error: "Station not found." }, { status: 404 });
    }
  }
  return Response.json({ station });
}

export async function PATCH(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const id = await stationId(context);
    const station = getStation(id);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const patch: Parameters<typeof updateStation>[1] = {};
    if (typeof body?.name === "string") patch.name = body.name;
    if (typeof body?.tagline === "string") patch.tagline = body.tagline;
    if (typeof body?.coverUrl === "string") patch.coverUrl = body.coverUrl;
    if (typeof body?.isPublic === "boolean") patch.isPublic = body.isPublic;
    if (body?.seedMixId === null || typeof body?.seedMixId === "number") {
      patch.seedMixId = body.seedMixId as number | null;
    }
    const updated = updateStation(id, patch);
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
