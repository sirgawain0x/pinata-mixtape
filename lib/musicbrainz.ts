import { publicRecordingUrl, recordingEmbedUrl } from "./recording-links";
import { youtubeVideoId } from "./youtube";

type MusicBrainzRecordingSearchOptions = {
  title?: string;
  artist?: string;
  query?: string;
  limit?: number;
};

export type MusicBrainzRecording = {
  id: string;
  title: string;
  score: number;
  length: number | null;
  disambiguation: string;
  firstReleaseDate: string;
  artistCredit: string;
  releaseTitles: string[];
  url: string;
};

type MusicBrainzRecordingResponse = {
  id: string;
  title: string;
  score?: number | string;
  length?: number | null;
  disambiguation?: string;
  "first-release-date"?: string;
  "artist-credit"?: Array<{
    name?: string;
    artist?: { name?: string };
    joinphrase?: string;
  }>;
  releases?: Array<{ title?: string }>;
};

type MusicBrainzSearchResponse = {
  recordings?: MusicBrainzRecordingResponse[];
};

const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2/recording";
const USER_AGENT = "PinataMixtape/0.1.0 ( https://github.com/raid-guild )";

export async function findMusicBrainzRecordingLink(id: string, signal?: AbortSignal): Promise<string | undefined> {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return;
  signal?.throwIfAborted();
  await respectRateLimit();
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(3_000);
  const response = await fetch(`${MUSICBRAINZ_BASE}/${id}?inc=url-rels&fmt=json`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    next: { revalidate: 86_400 }
  });
  if (!response.ok) return;
  const data = await response.json() as { relations?: { url?: { resource?: string } }[] };
  for (const relation of data.relations ?? []) {
    const url = publicRecordingUrl(relation.url?.resource);
    if (!url) continue;
    const isCatalogLink = ["open.spotify.com", "music.apple.com", "embed.music.apple.com"].includes(url.hostname);
    if ((isCatalogLink && recordingEmbedUrl(url.href)) || /^[A-Za-z0-9_-]{11}$/.test(youtubeVideoId(url.href))) {
      return url.href;
    }
  }
}

let lastMusicBrainzRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  const scheduledAt = Math.max(now, lastMusicBrainzRequestAt + 1100);
  lastMusicBrainzRequestAt = scheduledAt;
  if (scheduledAt > now) await sleep(scheduledAt - now);
}

function quotedTerm(value: string): string {
  return `"${value.replaceAll("\"", "")}"`;
}

function buildQuery({ title, artist, query }: MusicBrainzRecordingSearchOptions): string {
  const directQuery = query?.trim();
  if (directQuery) return directQuery;

  const parts: string[] = [];
  if (title?.trim()) parts.push(`recording:${quotedTerm(title.trim())}`);
  if (artist?.trim()) parts.push(`artist:${quotedTerm(artist.trim())}`);

  if (parts.length === 0) {
    throw new Error("A MusicBrainz search requires `query` or at least `title`.");
  }

  return parts.join(" AND ");
}

function artistCreditLabel(value: MusicBrainzRecordingResponse["artist-credit"]): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((credit) => {
      const name = credit.name ?? credit.artist?.name ?? "";
      return `${name}${credit.joinphrase ?? ""}`;
    })
    .join("")
    .trim();
}

function mapRecording(recording: MusicBrainzRecordingResponse): MusicBrainzRecording {
  return {
    id: recording.id,
    title: recording.title,
    score: Number(recording.score ?? 0),
    length: typeof recording.length === "number" ? recording.length : null,
    disambiguation: recording.disambiguation ?? "",
    firstReleaseDate: recording["first-release-date"] ?? "",
    artistCredit: artistCreditLabel(recording["artist-credit"]),
    releaseTitles: Array.isArray(recording.releases)
      ? recording.releases.map((release) => release.title ?? "").filter(Boolean)
      : [],
    url: `https://musicbrainz.org/recording/${recording.id}`
  };
}

export async function searchMusicBrainzRecordings(
  options: MusicBrainzRecordingSearchOptions
): Promise<{ query: string; recordings: MusicBrainzRecording[] }> {
  const query = buildQuery(options);
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);

  await respectRateLimit();

  const url = new URL(MUSICBRAINZ_BASE);
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz lookup failed with status ${response.status}.`);
  }

  const data = (await response.json()) as MusicBrainzSearchResponse;
  return {
    query,
    recordings: Array.isArray(data.recordings) ? data.recordings.map(mapRecording) : []
  };
}
