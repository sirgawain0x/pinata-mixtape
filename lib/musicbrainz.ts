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

let lastMusicBrainzRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastMusicBrainzRequestAt;
  const minGapMs = 1100;

  if (elapsed < minGapMs) {
    await sleep(minGapMs - elapsed);
  }

  lastMusicBrainzRequestAt = Date.now();
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
