import { youtubeVideoId } from "./youtube";

export type PlaybackSourceKind = "pinata" | "livepeer" | "youtube" | "iframe" | "link_only";

export type SongPlaybackFields = {
  audioCid?: string;
  audioUrl?: string;
  isCurated?: boolean;
  livepeerPlaybackId?: string;
  embedSourceKind?: string;
  youtubeUrl?: string;
  embedIframeUrl?: string;
  creativeTvUrl?: string;
  listenUrl?: string;
};

export type ResolvedPlaybackSource = {
  kind: PlaybackSourceKind;
  audioUrl?: string;
  livepeerPlaybackId?: string;
  youtubeVideoId?: string;
  iframeUrl?: string;
  outboundUrl?: string;
};

export function resolvePlaybackSource(song: SongPlaybackFields): ResolvedPlaybackSource {
  const audioCid = song.audioCid?.trim() ?? "";
  const audioUrl = song.audioUrl?.trim() ?? "";
  const isCurated = Boolean(song.isCurated);

  if (isCurated && (audioCid || audioUrl)) {
    return { kind: "pinata", audioUrl: audioUrl || undefined };
  }

  const livepeerPlaybackId = song.livepeerPlaybackId?.trim() ?? "";
  if (livepeerPlaybackId) {
    return { kind: "livepeer", livepeerPlaybackId };
  }

  const embedKind = song.embedSourceKind ?? "youtube";
  const youtubeUrl = song.youtubeUrl?.trim() ?? "";
  const videoId = youtubeVideoId(youtubeUrl);

  if (embedKind === "youtube" && videoId) {
    return { kind: "youtube", youtubeVideoId: videoId };
  }

  const iframeUrl = song.embedIframeUrl?.trim() ?? "";
  if (embedKind === "iframe_allowed" && iframeUrl) {
    return { kind: "iframe", iframeUrl };
  }

  if (embedKind === "creativetv" && song.creativeTvUrl?.trim()) {
    return { kind: "link_only", outboundUrl: song.creativeTvUrl.trim() };
  }

  const listenUrl = song.listenUrl?.trim() ?? "";
  if (listenUrl) {
    return { kind: "link_only", outboundUrl: listenUrl };
  }

  if (song.creativeTvUrl?.trim()) {
    return { kind: "link_only", outboundUrl: song.creativeTvUrl.trim() };
  }

  return { kind: "link_only" };
}
