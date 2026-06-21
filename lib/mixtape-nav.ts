export type CrateUrlParams = {
  mixId?: number | null;
  trackIndex?: number | null;
  songId?: number | null;
  view?: "broadcast" | "explorer";
};

export type MixWithTracks = {
  id: number;
  title?: string;
  tracks: Array<{ songId?: number; title: string; artist: string }>;
};

export type SongWithMixIds = {
  id: number;
  mixIds: number[];
};

export function buildCrateUrl(params: CrateUrlParams = {}): string {
  const search = new URLSearchParams();
  if (params.mixId != null) search.set("mix", String(params.mixId));
  if (params.trackIndex != null && params.trackIndex >= 0) search.set("track", String(params.trackIndex));
  if (params.songId != null) search.set("song", String(params.songId));
  if (params.view === "broadcast") search.set("view", "broadcast");
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

export function buildSongUrl(
  songId: number,
  options: { fromMix?: number | null; track?: number | null } = {}
): string {
  const search = new URLSearchParams();
  if (options.fromMix != null) search.set("fromMix", String(options.fromMix));
  if (options.track != null && options.track >= 0) search.set("track", String(options.track));
  const query = search.toString();
  return query ? `/songs/${songId}?${query}` : `/songs/${songId}`;
}

export function findTrackIndexInMix(mix: MixWithTracks, songId: number): number {
  return mix.tracks.findIndex((track) => track.songId === songId);
}

export function findMixForSong(
  mixes: MixWithTracks[],
  song: SongWithMixIds,
  preferredMixId?: number | null
): { mix: MixWithTracks; trackIndex: number } | null {
  const orderedIds =
    preferredMixId && song.mixIds.includes(preferredMixId)
      ? [preferredMixId, ...song.mixIds.filter((id) => id !== preferredMixId)]
      : song.mixIds;

  for (const mixId of orderedIds) {
    const mix = mixes.find((entry) => entry.id === mixId);
    if (!mix) continue;
    const trackIndex = findTrackIndexInMix(mix, song.id);
    if (trackIndex >= 0) return { mix, trackIndex };
  }

  return null;
}

export function resolveSongDeepLink(
  mixes: MixWithTracks[],
  songId: number,
  mixIdHint?: number | null
): { mixId: number; trackIndex: number } | null {
  if (mixIdHint != null) {
    const mix = mixes.find((entry) => entry.id === mixIdHint);
    if (mix) {
      const trackIndex = findTrackIndexInMix(mix, songId);
      if (trackIndex >= 0) return { mixId: mix.id, trackIndex };
    }
  }

  for (const mix of mixes) {
    if (mix.id === mixIdHint) continue;
    const trackIndex = findTrackIndexInMix(mix, songId);
    if (trackIndex >= 0) return { mixId: mix.id, trackIndex };
  }

  return null;
}
