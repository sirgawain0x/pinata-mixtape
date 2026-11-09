import { inferAssistantTrackEmbed } from "./song-playback";
import type { MixInput, TrackInput } from "./mixtapes";

export type PlaylistTrackChange = "add" | "remove" | "replace";

function uniqueRecordingIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function previousRecordingIds(previous: MixInput | null | undefined): string[] {
  return uniqueRecordingIds(
    (previous?.tracks ?? []).map((track) => track.musicbrainzId ?? "").filter(Boolean)
  );
}

export function applyPlaylistTrackChange(
  previous: MixInput | null | undefined,
  trackChange: PlaylistTrackChange,
  recordingIds: string[],
  removeRecordingIds: string[]
): string[] {
  const prevIds = previousRecordingIds(previous);
  const nextIds = uniqueRecordingIds(recordingIds);
  const removeIds = new Set(uniqueRecordingIds(removeRecordingIds));

  if (!prevIds.length) return nextIds;

  switch (trackChange) {
    case "add":
      return uniqueRecordingIds([...prevIds, ...nextIds]);
    case "remove":
      return prevIds.filter((id) => !removeIds.has(id));
    case "replace":
      return nextIds;
    default: {
      const _exhaustive: never = trackChange;
      return _exhaustive;
    }
  }
}

function trackByRecordingId(tracks: TrackInput[]): Map<string, TrackInput> {
  const map = new Map<string, TrackInput>();
  for (const track of tracks) {
    const id = track.musicbrainzId?.trim();
    if (id) map.set(id, track);
  }
  return map;
}

export function applyAssistantEmbedsToTracks(tracks: TrackInput[]): TrackInput[] {
  return tracks.map((track) => {
    const embed = inferAssistantTrackEmbed(track.listenUrl, track.youtubeUrl);
    return {
      ...track,
      embedSourceKind: embed.embedSourceKind,
      embedIframeUrl: embed.embedIframeUrl,
      youtubeUrl: embed.youtubeUrl || track.youtubeUrl,
    };
  });
}

export function mergePlaylistDraft(
  previous: MixInput | null | undefined,
  next: MixInput,
  recordingIds: string[]
): MixInput {
  const previousTracks = previous?.tracks ?? [];
  const nextTracks = next.tracks ?? [];
  const byId = new Map([...trackByRecordingId(previousTracks), ...trackByRecordingId(nextTracks)]);
  const tracks = applyAssistantEmbedsToTracks(
    recordingIds.flatMap((id) => {
      const track = byId.get(id);
      return track ? [track] : [];
    })
  );
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
