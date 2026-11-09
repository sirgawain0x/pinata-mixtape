import type { MixInput, TrackInput } from "./mixtapes";

const REMOVAL_PATTERN = /\b(remove|drop|delete|take out|without|minus)\b/i;

export function mergePlaylistRecordingIds(
  previous: MixInput | null | undefined,
  nextRecordingIds: string[],
  lastUserMessage: string
): string[] {
  const prevIds = (previous?.tracks ?? [])
    .map((track) => track.musicbrainzId?.trim())
    .filter((id): id is string => Boolean(id));
  const nextIds = [...new Set(nextRecordingIds.map((id) => id.trim()).filter(Boolean))];
  if (!prevIds.length) return nextIds;
  if (!nextIds.length && !REMOVAL_PATTERN.test(lastUserMessage)) return prevIds;
  if (REMOVAL_PATTERN.test(lastUserMessage) || (nextIds.length > 0 && nextIds.length < prevIds.length)) {
    return nextIds;
  }
  return [...new Set([...prevIds, ...nextIds])];
}

function trackByRecordingId(tracks: TrackInput[]): Map<string, TrackInput> {
  const map = new Map<string, TrackInput>();
  for (const track of tracks) {
    const id = track.musicbrainzId?.trim();
    if (id) map.set(id, track);
  }
  return map;
}

export function mergePlaylistDraft(
  previous: MixInput | null | undefined,
  next: MixInput,
  recordingIds: string[]
): MixInput {
  const previousTracks = previous?.tracks ?? [];
  const nextTracks = next.tracks ?? [];
  const byId = new Map([...trackByRecordingId(previousTracks), ...trackByRecordingId(nextTracks)]);
  const tracks = recordingIds.flatMap((id) => {
    const track = byId.get(id);
    return track ? [track] : [];
  });
  const nextCreators = next.creators?.map((name) => name.trim()).filter(Boolean) ?? [];
  const previousCreators = previous?.creators?.map((name) => name.trim()).filter(Boolean) ?? [];
  return {
    ...next,
    title: next.title?.trim() || previous?.title || next.title,
    description: next.description?.trim() || previous?.description || "",
    genre: next.genre?.trim() || previous?.genre || "",
    sourceUrl: next.sourceUrl?.trim() || previous?.sourceUrl || "",
    creators: nextCreators.length ? nextCreators : previousCreators,
    tracks,
  };
}
