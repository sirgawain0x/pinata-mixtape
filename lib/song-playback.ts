import { youtubeVideoId } from "./youtube";
import { preferredRecordingLink, publicRecordingUrl, recordingEmbedUrl, streamingAppLinks } from "./recording-links";

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
  title?: string;
  artist?: string;
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
  const outboundUrl = preferredRecordingLink(song.title ?? "", song.artist ?? "",
    song.listenUrl, song.youtubeUrl, song.creativeTvUrl, song.embedIframeUrl) || undefined;

  if (isCurated && (audioCid || audioUrl)) {
    return { kind: "pinata", audioUrl: audioUrl || `https://gateway.pinata.cloud/ipfs/${encodeURIComponent(audioCid)}`, outboundUrl };
  }

  const youtubeUrl = publicRecordingUrl(song.youtubeUrl)?.toString() ?? "";
  const explicitVideoId = youtubeVideoId(youtubeUrl);
  if (song.embedSourceKind === "youtube" && explicitVideoId) {
    return { kind: "youtube", youtubeVideoId: explicitVideoId, outboundUrl };
  }

  const livepeerPlaybackId = song.livepeerPlaybackId?.trim() ?? "";
  if (livepeerPlaybackId) {
    return { kind: "livepeer", livepeerPlaybackId, outboundUrl };
  }

  const embedKind = song.embedSourceKind ?? "youtube";
  const listenUrl = publicRecordingUrl(song.listenUrl)?.toString() ?? "";
  const videoId = explicitVideoId || youtubeVideoId(listenUrl);

  if (embedKind === "youtube" && videoId) {
    return { kind: "youtube", youtubeVideoId: videoId, outboundUrl };
  }

  const iframeUrl = recordingEmbedUrl(song.embedIframeUrl) || publicRecordingUrl(song.embedIframeUrl)?.toString();
  if (embedKind === "iframe_allowed" && iframeUrl) {
    const { appleMusic, spotify } = streamingAppLinks(song.listenUrl, song.embedIframeUrl);
    if (appleMusic && spotify && streamingAppLinks(iframeUrl).spotify) {
      return { kind: "iframe", iframeUrl: recordingEmbedUrl(appleMusic), outboundUrl };
    }
    return { kind: "iframe", iframeUrl, outboundUrl };
  }

  if (embedKind === "youtube") {
    const providerEmbed = recordingEmbedUrl(listenUrl) || recordingEmbedUrl(youtubeUrl);
    if (providerEmbed) return { kind: "iframe", iframeUrl: providerEmbed, outboundUrl };
  }

  return { kind: "link_only", outboundUrl };
}

export type TrackPlaybackStatus = "playable" | "embed" | "link_only" | "missing";

export function getTrackPlaybackStatus(song: SongPlaybackFields): TrackPlaybackStatus {
  const source = resolvePlaybackSource(song);
  if (source.kind === "link_only") {
    return source.outboundUrl ? "link_only" : "missing";
  }
  if (source.kind === "iframe") return "embed";
  return "playable";
}

export function trackPlaybackStatusLabel(status: TrackPlaybackStatus): string {
  switch (status) {
    case "playable":
      return "Playable";
    case "embed":
      return "Embed";
    case "link_only":
      return "Link only";
    default:
      return "Missing source";
  }
}
