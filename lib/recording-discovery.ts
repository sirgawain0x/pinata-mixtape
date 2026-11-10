import { findMusicBrainzRecordingLink } from "./musicbrainz";
import { buildYoutubeSearchUrl } from "./recording-links";
import { findYoutubeVideoForRecording, trackAlreadyHasYoutubeVideo } from "./youtube-data-lookup-core";

type Recording = {
  musicbrainzId?: string;
  title: string;
  artist: string;
  albumTitle?: string;
  durationMs?: number | null;
};

type ListeningLinkOptions = {
  youtubeApiBudget?: { remaining: number };
};

export async function findRecordingListeningLink(
  recording: Recording,
  signal?: AbortSignal,
  options?: ListeningLinkOptions
): Promise<string | undefined> {
  if (!recording.title.trim() || !recording.artist.trim() || signal?.aborted) return;

  if (recording.musicbrainzId) {
    const linked = await findMusicBrainzRecordingLink(recording.musicbrainzId, signal).catch(() => undefined);
    if (linked && trackAlreadyHasYoutubeVideo(linked)) return linked;
  }

  const budget = options?.youtubeApiBudget;
  if (!budget || budget.remaining <= 0) {
    return buildYoutubeSearchUrl(recording.title, recording.artist);
  }

  budget.remaining -= 1;

  const result = await findYoutubeVideoForRecording(
    {
      musicbrainzId: recording.musicbrainzId,
      title: recording.title,
      artist: recording.artist,
      durationMs: recording.durationMs ?? null,
    },
    signal
  );
  return result.kind === "video" ? result.watchUrl : result.searchUrl;
}
