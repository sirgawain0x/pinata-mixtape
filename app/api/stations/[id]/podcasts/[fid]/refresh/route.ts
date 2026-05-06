import { withCreator } from "../../../../../../../lib/auth";
import { getPodcastFeed, getStation } from "../../../../../../../lib/stations";
import { materializeEpisodesAsSegments, refreshFeed } from "../../../../../../../lib/podcasts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; fid: string }> };

export async function POST(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const stationId = Number(params.id);
    if (!Number.isInteger(stationId) || stationId < 1) {
      return Response.json({ error: "Invalid station id." }, { status: 400 });
    }
    const feedId = Number(params.fid);
    if (!Number.isInteger(feedId) || feedId < 1) {
      return Response.json({ error: "Invalid feed id." }, { status: 400 });
    }
    const station = getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    const feed = getPodcastFeed(feedId);
    if (!feed || feed.stationId !== stationId) {
      return Response.json({ error: "Feed not found." }, { status: 404 });
    }
    await refreshFeed(feedId);
    const added = await materializeEpisodesAsSegments(feed, { limit: 3 });
    return Response.json({ ok: true, segmentsAdded: added });
  });
}
