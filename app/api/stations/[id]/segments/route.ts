import { withCreator } from "../../../../../lib/auth";
import {
  addSegment,
  getStation,
  listStationSegments,
  type SegmentKind
} from "../../../../../lib/stations";
import { createSong, getSong } from "../../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const VALID_KINDS = new Set<SegmentKind>(["music", "voice", "upload", "text", "podcast"]);

async function stationId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

export async function GET(_request: Request, context: Context) {
  const id = await stationId(context);
  const station = getStation(id);
  if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
  return Response.json({ segments: listStationSegments(id) });
}

export async function POST(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const id = await stationId(context);
    const station = getStation(id);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: "Body required." }, { status: 400 });

    const kind = body.kind as SegmentKind;
    if (!VALID_KINDS.has(kind)) {
      return Response.json({ error: "Invalid segment kind." }, { status: 400 });
    }

    let songId: number | null = typeof body.songId === "number" ? body.songId : null;
    if (kind === "music") {
      if (!songId && body.song && typeof body.song === "object") {
        const created = createSong(body.song);
        songId = created.id;
      }
      if (!songId || !getSong(songId)) {
        return Response.json({ error: "Music segment needs songId or song." }, { status: 400 });
      }
    }

    try {
      const segment = addSegment({
        stationId: id,
        kind,
        title: typeof body.title === "string" ? body.title : "",
        body: typeof body.body === "string" ? body.body : "",
        songId,
        audioCid: typeof body.audioCid === "string" ? body.audioCid : "",
        audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : "",
        durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : null,
        podcastEpisodeId: typeof body.podcastEpisodeId === "number" ? body.podcastEpisodeId : null,
        ttsVoice: typeof body.ttsVoice === "string" ? body.ttsVoice : "",
        ttsProvider: typeof body.ttsProvider === "string" ? body.ttsProvider : "",
        position: typeof body.position === "number" ? body.position : undefined
      });
      return Response.json({ segment }, { status: 201 });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }
  });
}
