import { publicRecordingUrl } from "./recording-links";
import { resolvePlaybackSource, type SongPlaybackFields } from "./song-playback";
import { youtubeVideoId } from "./youtube";

const LEGACY_STREAMING_HOSTS = new Set([
  "open.spotify.com",
  "music.apple.com",
  "embed.music.apple.com",
  "soundcloud.com",
  "www.soundcloud.com",
  "m.soundcloud.com",
  "w.soundcloud.com",
]);

function hasCreativeTvUrl(value?: string): boolean {
  const url = publicRecordingUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return (host === "tv.creativeplatform.xyz" || host.endsWith(".creativeplatform.xyz")) &&
    /^\/discover\/[0-9a-f-]{36}\/?$/i.test(url.pathname);
}

function hostname(value?: string): string {
  return publicRecordingUrl(value)?.hostname.replace(/^www\./, "").toLowerCase() ?? "";
}

export function isLegacyStreamingUrl(value?: string): boolean {
  const host = hostname(value);
  return LEGACY_STREAMING_HOSTS.has(host) || host.endsWith(".soundcloud.com");
}

export function trackHasInAppPlayableSource(track: SongPlaybackFields): boolean {
  if (youtubeVideoId(track.youtubeUrl ?? "") || youtubeVideoId(track.listenUrl ?? "")) return true;
  if (track.embedSourceKind === "youtube" && youtubeVideoId(track.youtubeUrl ?? track.listenUrl ?? "")) return true;
  if (track.embedSourceKind === "creativetv" && hasCreativeTvUrl(track.creativeTvUrl)) return true;
  if (Boolean(track.isCurated) && (track.audioCid?.trim() || track.audioUrl?.trim())) return true;
  if (track.livepeerPlaybackId?.trim()) return true;
  const source = resolvePlaybackSource(track);
  return source.kind === "pinata" || source.kind === "livepeer" || source.kind === "youtube" ||
    (source.kind === "iframe" && Boolean(source.iframeUrl) && !isLegacyStreamingUrl(source.iframeUrl));
}

export function trackUsesOnlyLegacyStreamingSources(track: SongPlaybackFields): boolean {
  const legacy =
    isLegacyStreamingUrl(track.listenUrl) ||
    isLegacyStreamingUrl(track.embedIframeUrl) ||
    (track.embedSourceKind === "iframe_allowed" &&
      (isLegacyStreamingUrl(track.embedIframeUrl) || isLegacyStreamingUrl(track.listenUrl)));
  return legacy && !trackHasInAppPlayableSource(track);
}

export function isTrackHiddenFromPublicPlayback(track: SongPlaybackFields): boolean {
  return trackUsesOnlyLegacyStreamingSources(track);
}

export function legacyStreamingEditorNote(track: SongPlaybackFields): string | null {
  return trackUsesOnlyLegacyStreamingSources(track) ? "Hidden: unsupported source" : null;
}

export function filterPublicPlaybackTracks<T extends SongPlaybackFields>(tracks: T[]): T[] {
  return tracks.filter((track) => !isTrackHiddenFromPublicPlayback(track));
}
