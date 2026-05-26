import { withCreator } from "../../../../../../lib/auth";
import { deleteSegment, getSegment, getStation, updateSegment } from "../../../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; sid: string }> };

async function ids(context: Context): Promise<{ stationId: number; segmentId: number }> {
  const params = await context.params;
  const stationId = Number(params.id);
  const segmentId = Number(params.sid);
  if (!Number.isInteger(stationId) || stationId < 1 || !Number.isInteger(segmentId) || segmentId < 1) {
    throw new Error("Invalid id.");
  }
  return { stationId, segmentId };
}

async function loadOwned(context: Context, creatorId: number) {
  let stationId: number;
  let segmentId: number;
  try {
    ({ stationId, segmentId } = await ids(context));
  } catch {
    return { error: "Invalid id.", status: 400 } as const;
  }
  const station = await getStation(stationId);
  if (!station) return { error: "Station not found.", status: 404 } as const;
  if (station.creatorId !== creatorId) return { error: "Forbidden.", status: 403 } as const;
  const segment = await getSegment(segmentId);
  if (!segment || segment.stationId !== stationId) return { error: "Segment not found.", status: 404 } as const;
  return { segment } as const;
}

export async function PATCH(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const result = await loadOwned(context, creator.id);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const patch: Parameters<typeof updateSegment>[1] = {};
    if (typeof body?.title === "string") patch.title = body.title;
    if (typeof body?.body === "string") patch.body = body.body;
    if (typeof body?.audioCid === "string") patch.audioCid = body.audioCid;
    if (typeof body?.audioUrl === "string") patch.audioUrl = body.audioUrl;
    if (body?.durationSeconds === null || typeof body?.durationSeconds === "number") {
      patch.durationSeconds = body.durationSeconds as number | null;
    }
    if (typeof body?.ttsVoice === "string") patch.ttsVoice = body.ttsVoice;
    if (typeof body?.ttsProvider === "string") patch.ttsProvider = body.ttsProvider;
    const updated = await updateSegment(result.segment.id, patch);
    return Response.json({ segment: updated });
  });
}

export async function DELETE(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const result = await loadOwned(context, creator.id);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    await deleteSegment(result.segment.id);
    return Response.json({ ok: true });
  });
}
