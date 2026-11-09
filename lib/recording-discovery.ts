import { findMusicBrainzRecordingLink } from "./musicbrainz";
import { rateLimitHit } from "./rate-limit";

type Recording = {
  musicbrainzId?: string;
  title: string;
  artist: string;
  albumTitle?: string;
};

type AppleSong = {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
};

function normalized(value = ""): string {
  return value.trim().normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

export async function findRecordingListeningLink(recording: Recording, signal?: AbortSignal): Promise<string | undefined> {
  if (recording.musicbrainzId) {
    const linked = await findMusicBrainzRecordingLink(recording.musicbrainzId, signal).catch(() => undefined);
    if (linked) return linked;
  }
  if (!recording.title.trim() || !recording.artist.trim() || signal?.aborted) return;
  if (!rateLimitHit("apple-recording-search", 18, 60_000)) return;

  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams({
    term: `${recording.title} ${recording.artist}`,
    country: "US",
    media: "music",
    entity: "song",
    limit: "15"
  }).toString();
  const timeout = AbortSignal.timeout(2_500);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    next: { revalidate: 86_400 }
  });
  if (!response.ok) return;

  const { results } = await response.json() as { results?: AppleSong[] };
  const album = normalized(recording.albumTitle);
  const matches = (results ?? []).filter((song) =>
    song.kind === "song" && Number.isSafeInteger(song.trackId) &&
    normalized(song.trackName) === normalized(recording.title) &&
    normalized(song.artistName) === normalized(recording.artist) &&
    (!album || normalized(song.collectionName) === album));
  const ids = new Set(matches.map((song) => song.trackId));
  if (ids.size === 1) return `https://music.apple.com/us/song/${matches[0].trackId}`;
}
