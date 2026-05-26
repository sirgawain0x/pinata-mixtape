import Parser from "rss-parser";
import { assertPublicHttpUrl, fetchWithTimeout } from "./outbound";
import {
  addPodcastFeed,
  addSegment,
  getPodcastFeed,
  listPodcastEpisodes,
  listStationSegments,
  touchPodcastFeed,
  upsertPodcastEpisode,
  type PodcastEpisode,
  type PodcastFeed
} from "./stations";

const RSS_FETCH_TIMEOUT_MS = 15_000;

const parser = new Parser({
  customFields: {
    item: ["enclosure", "guid", "itunes:duration"]
  }
});

async function fetchPublicText(url: string, redirectsRemaining = 3): Promise<string> {
  const safeUrl = assertPublicHttpUrl(url, "Feed URL");
  const response = await fetchWithTimeout(safeUrl, { redirect: "manual" }, RSS_FETCH_TIMEOUT_MS);

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirectsRemaining <= 0) {
      throw new Error("Feed URL redirected too many times.");
    }
    return fetchPublicText(new URL(location, safeUrl).toString(), redirectsRemaining - 1);
  }

  if (!response.ok) {
    throw new Error(`Feed fetch failed (${response.status}).`);
  }

  return response.text();
}

function parseDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export async function refreshFeed(feedId: number): Promise<PodcastEpisode[]> {
  const feed = await getPodcastFeed(feedId);
  if (!feed) throw new Error("Feed not found.");

  const parsed = await parser.parseString(await fetchPublicText(feed.feedUrl));
  if (parsed.title) {
    await addPodcastFeed(feed.stationId, feed.feedUrl, parsed.title);
  }

  const episodes: PodcastEpisode[] = [];
  for (const item of parsed.items) {
    const itemRecord = item as unknown as Record<string, unknown>;
    const enclosure = itemRecord.enclosure as { url?: string } | undefined;
    const audioUrl = enclosure?.url ?? "";
    if (!audioUrl) continue;
    try {
      assertPublicHttpUrl(audioUrl, "Episode audio URL");
    } catch {
      continue;
    }
    const guid = (itemRecord.guid as string | undefined) || `${audioUrl}:${item.title ?? ""}`;
    const episode = await upsertPodcastEpisode({
      feedId: feed.id,
      guid: String(guid),
      title: item.title ?? "Untitled episode",
      audioUrl,
      publishedAt: item.isoDate ?? item.pubDate ?? null,
      durationSeconds: parseDuration(itemRecord["itunes:duration"])
    });
    episodes.push(episode);
  }
  await touchPodcastFeed(feed.id);
  return episodes;
}

export async function materializeEpisodesAsSegments(
  feed: PodcastFeed,
  options: { limit?: number } = {}
): Promise<number> {
  const episodes = await listPodcastEpisodes(feed.id, options.limit ?? 5);
  const segments = await listStationSegments(feed.stationId);
  const alreadyMaterialized = new Set(
    segments
      .filter((segment) => segment.kind === "podcast" && segment.podcastEpisodeId !== null)
      .map((segment) => segment.podcastEpisodeId as number)
  );
  let added = 0;
  for (const episode of episodes) {
    if (alreadyMaterialized.has(episode.id)) continue;
    await addSegment({
      stationId: feed.stationId,
      kind: "podcast",
      title: episode.title || "Podcast episode",
      audioUrl: episode.audioUrl,
      durationSeconds: episode.durationSeconds,
      podcastEpisodeId: episode.id
    });
    added += 1;
  }
  return added;
}
