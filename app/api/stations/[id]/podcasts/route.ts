import { withCreator } from "../../../../../lib/auth";
import { addPodcastFeed, getStation, listPodcastFeeds } from "../../../../../lib/stations";
import { materializeEpisodesAsSegments, refreshFeed } from "../../../../../lib/podcasts";
import { assertPublicHttpUrl, parsePositiveInteger } from "../../../../../lib/outbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const stationId = parsePositiveInteger(params.id);
    if (stationId === null) {
      return Response.json({ error: "Invalid station id." }, { status: 400 });
    }
    const station = await getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    return Response.json({ feeds: await listPodcastFeeds(stationId) });
  });
}

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
    const feedUrl = typeof body?.feedUrl === "string" ? body.feedUrl.trim() : "";
    if (!feedUrl) return Response.json({ error: "feedUrl required." }, { status: 400 });

    try {
      const normalizedFeedUrl = assertPublicHttpUrl(feedUrl, "feedUrl").toString();
      const feed = await addPodcastFeed(stationId, normalizedFeedUrl);
      await refreshFeed(feed.id);
      const added = await materializeEpisodesAsSegments(feed, { limit: 3 });
      return Response.json({ feed, segmentsAdded: added }, { status: 201 });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }
  });
}
