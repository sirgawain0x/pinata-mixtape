import { fetchWithTimeout } from "./outbound";
import { buildYoutubeSearchUrl } from "./recording-links";
import { youtubeVideoId } from "./youtube";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const LOOKUP_TIMEOUT_MS = 4_000;
const MAX_CACHE_ENTRIES = 500;
const MAX_RESULTS = 3;

export type YoutubeLookupInput = {
  musicbrainzId?: string;
  title: string;
  artist: string;
  durationMs?: number | null;
};

export type YoutubeLookupResult =
  | { kind: "video"; watchUrl: string; videoId: string }
  | { kind: "search_fallback"; searchUrl: string };

type YoutubeApiItem = {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string };
  contentDetails?: { duration?: string };
};

const cache = new Map<string, string>();
const cacheOrder: string[] = [];

function rememberCache(cacheKey: string, watchUrl: string) {
  if (cache.has(cacheKey)) {
    cache.set(cacheKey, watchUrl);
    return;
  }
  cache.set(cacheKey, watchUrl);
  cacheOrder.push(cacheKey);
  while (cacheOrder.length > MAX_CACHE_ENTRIES) {
    const oldest = cacheOrder.shift();
    if (oldest) cache.delete(oldest);
  }
}

export function buildYoutubeDataSearchQuery(title: string, artist: string): string {
  return [artist.trim(), title.trim()].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

export function parseYoutubeDurationSeconds(iso?: string): number | null {
  if (!iso?.startsWith("PT")) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

const KARAOKE_PATTERN = /\b(karaoke|cover version|cover by|tribute to|8\s*bit|8-bit)\b/i;

function normalizedTokens(value: string): string[] {
  return value
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreYoutubeSearchCandidate(
  item: YoutubeApiItem,
  artist: string,
  title: string,
  durationMs?: number | null
): number {
  const videoTitle = item.snippet?.title ?? "";
  const channel = item.snippet?.channelTitle ?? "";
  const combined = `${videoTitle} ${channel}`.toLowerCase();
  const artistTokens = normalizedTokens(artist);
  const titleTokens = normalizedTokens(title);
  let score = 0;

  const matchedArtist = artistTokens.some((token) => token.length > 2 && combined.includes(token));
  if (matchedArtist) score += 40;
  const matchedTitle = titleTokens.some((token) => token.length > 2 && combined.includes(token));
  if (matchedTitle) score += 25;

  if (KARAOKE_PATTERN.test(combined)) score -= 50;

  const durationSeconds = parseYoutubeDurationSeconds(item.contentDetails?.duration);
  if (durationMs && durationMs > 0 && durationSeconds) {
    const target = Math.round(durationMs / 1000);
    const delta = Math.abs(durationSeconds - target);
    if (delta <= 7) score += 30;
    else if (delta <= 20) score += 12;
    else if (delta > 90) score -= 15;
  }

  return score;
}

export function pickBestYoutubeSearchItem(
  items: YoutubeApiItem[],
  artist: string,
  title: string,
  durationMs?: number | null
): YoutubeApiItem | undefined {
  const ranked = items
    .filter((item) => item.id?.videoId && youtubeVideoId(`https://youtu.be/${item.id.videoId}`))
    .map((item) => ({ item, score: scoreYoutubeSearchCandidate(item, artist, title, durationMs) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < 20) return undefined;
  return best.item;
}

export function parseYoutubeSearchResponse(body: unknown): YoutubeApiItem[] {
  if (!body || typeof body !== "object") return [];
  const items = (body as { items?: unknown }).items;
  return Array.isArray(items) ? (items as YoutubeApiItem[]) : [];
}

function watchUrlForVideoId(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function readYoutubeApiKey(): string | undefined {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key || undefined;
}

export function trackAlreadyHasYoutubeVideo(youtubeUrl?: string, listenUrl?: string): boolean {
  return Boolean(youtubeVideoId(youtubeUrl ?? "") || youtubeVideoId(listenUrl ?? ""));
}

export async function findYoutubeVideoForRecording(
  input: YoutubeLookupInput,
  signal?: AbortSignal
): Promise<YoutubeLookupResult> {
  const fallbackSearch = buildYoutubeSearchUrl(input.title, input.artist);

  const query = buildYoutubeDataSearchQuery(input.title, input.artist);
  const apiKey = readYoutubeApiKey();
  if (!query || !apiKey) return { kind: "search_fallback", searchUrl: fallbackSearch };

  const cacheKey = JSON.stringify([input.musicbrainzId?.trim(), input.title.trim(), input.artist.trim(), input.durationMs ?? null]);
  const cached = cache.get(cacheKey);
  const cachedVideoId = cached && youtubeVideoId(cached);
  if (cached && cachedVideoId) return { kind: "video", watchUrl: cached, videoId: cachedVideoId };

  const url = new URL(YOUTUBE_SEARCH_URL);
  url.search = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(MAX_RESULTS),
    q: query,
    key: apiKey,
  }).toString();

  try {
    const timeout = AbortSignal.timeout(LOOKUP_TIMEOUT_MS);
    const lookupSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await fetchWithTimeout(url, { signal: lookupSignal }, LOOKUP_TIMEOUT_MS);
    if (!response.ok) return { kind: "search_fallback", searchUrl: fallbackSearch };

    const items = parseYoutubeSearchResponse(await response.json());
    const videoIds = items.flatMap((item) => {
      const id = item.id?.videoId;
      return id && youtubeVideoId(`https://youtu.be/${id}`) ? [id] : [];
    });
    if (input.durationMs && videoIds.length) {
      const detailsUrl = new URL(YOUTUBE_VIDEOS_URL);
      detailsUrl.search = new URLSearchParams({
        part: "contentDetails",
        id: videoIds.join(","),
        key: apiKey,
      }).toString();
      const details = await fetchWithTimeout(detailsUrl, { signal: lookupSignal }, LOOKUP_TIMEOUT_MS)
        .then((result) => result.ok ? result.json() : null)
        .catch(() => null) as { items?: { id: string; contentDetails?: YoutubeApiItem["contentDetails"] }[] } | null;
      const byId = new Map(details?.items?.map((item) => [item.id, item.contentDetails]));
      for (const item of items) {
        if (item.id?.videoId) item.contentDetails = byId.get(item.id.videoId);
      }
    }
    const best = pickBestYoutubeSearchItem(items, input.artist, input.title, input.durationMs);
    const videoId = best?.id?.videoId;
    if (!videoId) return { kind: "search_fallback", searchUrl: fallbackSearch };

    const watchUrl = watchUrlForVideoId(videoId);
    rememberCache(cacheKey, watchUrl);
    return { kind: "video", watchUrl, videoId };
  } catch {
    return { kind: "search_fallback", searchUrl: fallbackSearch };
  }
}
