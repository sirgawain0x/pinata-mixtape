import Parser from "rss-parser";
import {
  addPodcastFeed,
  addSegment,
  getPodcastFeed,
  listPodcastEpisodes,
  touchPodcastFeed,
  upsertPodcastEpisode,
  type PodcastEpisode,
  type PodcastFeed
} from "./stations";

const parser = new Parser({
  customFields: {
    item: ["enclosure", "guid", "itunes:duration"]
  }
});

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
  const feed = getPodcastFeed(feedId);
  if (!feed) throw new Error("Feed not found.");

  const parsed = await parser.parseURL(feed.feedUrl);
  if (parsed.title) {
    addPodcastFeed(feed.stationId, feed.feedUrl, parsed.title);
  }

  const episodes: PodcastEpisode[] = [];
  for (const item of parsed.items) {
    const itemRecord = item as unknown as Record<string, unknown>;
    const enclosure = itemRecord.enclosure as { url?: string } | undefined;
    const audioUrl = enclosure?.url ?? "";
    if (!audioUrl) continue;
    const guid = (itemRecord.guid as string | undefined) || `${audioUrl}:${item.title ?? ""}`;
    const episode = upsertPodcastEpisode({
      feedId: feed.id,
      guid: String(guid),
      title: item.title ?? "Untitled episode",
      audioUrl,
      publishedAt: item.isoDate ?? item.pubDate ?? null,
      durationSeconds: parseDuration(itemRecord["itunes:duration"])
    });
    episodes.push(episode);
  }
  touchPodcastFeed(feed.id);
  return episodes;
}

export async function materializeEpisodesAsSegments(
  feed: PodcastFeed,
  options: { limit?: number } = {}
): Promise<number> {
  const episodes = listPodcastEpisodes(feed.id, options.limit ?? 5);
  let added = 0;
  for (const episode of episodes) {
    addSegment({
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
