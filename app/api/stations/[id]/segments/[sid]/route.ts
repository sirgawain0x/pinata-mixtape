import { withCreator } from "../../../../../../lib/auth";
import { deleteSegment, getSegment, getStation, updateSegment } from "../../../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; sid: string }> };

async function ids(context: Context): Promise<{ stationId: number; segmentId: number }> {
  const params = await context.params;
  return { stationId: Number(params.id), segmentId: Number(params.sid) };
}

async function loadOwned(context: Context, creatorId: number) {
  const { stationId, segmentId } = await ids(context);
  const station = getStation(stationId);
  if (!station) return { error: "Station not found.", status: 404 } as const;
  if (station.creatorId !== creatorId) return { error: "Forbidden.", status: 403 } as const;
  const segment = getSegment(segmentId);
  if (!segment || segment.stationId !== stationId) return { error: "Segment not found.", status: 404 } as const;
  return { segment } as const;
}

export async function PATCH(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const result = await loadOwned(context, creator.id);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    const body = await request.json().catch(() => null);
    const updated = updateSegment(result.segment.id, body ?? {});
    return Response.json({ segment: updated });
  });
}

export async function DELETE(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const result = await loadOwned(context, creator.id);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    deleteSegment(result.segment.id);
    return Response.json({ ok: true });
  });
}
