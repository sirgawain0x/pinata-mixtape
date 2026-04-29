import { withCreator } from "../../../../../lib/auth";
import { addPodcastFeed, getStation, listPodcastFeeds } from "../../../../../lib/stations";
import { materializeEpisodesAsSegments, refreshFeed } from "../../../../../lib/podcasts";
import { assertPublicHttpUrl } from "../../../../../lib/outbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const stationId = Number(params.id);
    const station = getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    return Response.json({ feeds: listPodcastFeeds(stationId) });
  });
}

export async function POST(request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const stationId = Number(params.id);
    const station = getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });

    const body = await request.json().catch(() => null);
    const feedUrl = typeof body?.feedUrl === "string" ? body.feedUrl.trim() : "";
    if (!feedUrl) return Response.json({ error: "feedUrl required." }, { status: 400 });

    try {
      const normalizedFeedUrl = assertPublicHttpUrl(feedUrl, "feedUrl").toString();
      const feed = addPodcastFeed(stationId, normalizedFeedUrl);
      await refreshFeed(feed.id);
      const added = await materializeEpisodesAsSegments(feed, { limit: 3 });
      return Response.json({ feed, segmentsAdded: added }, { status: 201 });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }
  });
}
