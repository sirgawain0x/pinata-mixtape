import { listAllFeeds } from "../../../../lib/stations";
import { refreshFeed } from "../../../../lib/podcasts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const provided = request.headers.get("x-cron-secret");
  if (provided !== expected) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  const feeds = listAllFeeds();
  const results: { feedId: number; ok: boolean; error?: string }[] = [];
  for (const feed of feeds) {
    try {
      await refreshFeed(feed.id);
      results.push({ feedId: feed.id, ok: true });
    } catch (error) {
      results.push({ feedId: feed.id, ok: false, error: (error as Error).message });
    }
  }
  return Response.json({ refreshed: results.length, results });
}
