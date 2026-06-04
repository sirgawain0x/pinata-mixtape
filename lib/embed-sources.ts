import { parseCreativeTvUrl } from "./creative-tv";
import { youtubeVideoId } from "./youtube";

export type EmbedSourceKind = "youtube" | "creativetv" | "iframe_allowed" | "link_only";

const DEFAULT_IFRAME_HOSTS = [
  "tv.creativeplatform.xyz",
  "open.spotify.com",
  "soundcloud.com",
  "www.soundcloud.com",
  "bandcamp.com",
  "music.apple.com",
  "embed.music.apple.com",
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "m.youtube.com",
  "w.soundcloud.com"
];

function iframeAllowedHostsEnv(): Set<string> {
  const raw = process.env.MIXTAPE_EMBED_IFRAME_HOSTS?.trim();
  if (!raw) return new Set(DEFAULT_IFRAME_HOSTS.map((h) => h.toLowerCase()));
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Hostnames allowed when embedSourceKind === iframe_allowed */
export function isAllowedIframeHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const set = iframeAllowedHostsEnv();
  return set.has(h) || [...set].some((allowed) => h.endsWith(`.${allowed}`));
}

export function parseAllowedEmbedUrl(raw: string): URL | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!isAllowedIframeHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Resolve effective embed kind when client sends ambiguous data */
export function resolveEmbedSourceKind(
  kind: unknown,
  youtubeUrl: string,
  iframeUrl: string,
  creativeTvUrl = ""
): EmbedSourceKind {
  if (kind === "link_only") return "link_only";
  if (kind === "creativetv") return "creativetv";
  if (kind === "iframe_allowed") return "iframe_allowed";
  if (kind === "youtube") return "youtube";
  if (parseCreativeTvUrl(creativeTvUrl)) return "creativetv";
  if (youtubeUrl.trim()) {
    return youtubeVideoId(youtubeUrl) ? "youtube" : "iframe_allowed";
  }
  const parsed = iframeUrl ? parseAllowedEmbedUrl(iframeUrl) : null;
  return parsed ? "iframe_allowed" : "link_only";
}
