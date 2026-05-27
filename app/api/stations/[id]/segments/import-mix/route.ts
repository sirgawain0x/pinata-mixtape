import { withCreator } from "../../../../../../lib/auth";
import { getMix } from "../../../../../../lib/mixtapes";
import { getStation, importStationMix } from "../../../../../../lib/stations";
import { parsePositiveInteger } from "../../../../../../lib/outbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const stationId = parsePositiveInteger(params.id);
    if (stationId === null) return Response.json({ error: "Invalid station id." }, { status: 400 });

    const station = await getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const mixId = typeof body?.mixId === "number" ? body.mixId : Number(body?.mixId);
    if (!Number.isFinite(mixId)) {
      return Response.json({ error: "`mixId` is required." }, { status: 400 });
    }

    const mix = await getMix(mixId);
    if (!mix) return Response.json({ error: "Mix not found." }, { status: 404 });

    try {
      const segments = await importStationMix({
        stationId,
        mixId,
        position: typeof body?.position === "number" ? body.position : undefined,
        clearExisting: Boolean(body?.clearExisting)
      });
      return Response.json({ segments, mixTitle: mix.title }, { status: 201 });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Import failed." },
        { status: 400 }
      );
    }
  });
}
