import { fetchWithTimeout } from "./outbound";

const DEFAULT_CRTV_API_URL = "https://tv.creativeplatform.xyz";
const CRTV_PLAYBACK_PATH = "/api/video-assets/by-asset-id";

export type CreativeTvParsed = {
  postId: string;
  discoverUrl: string;
};

export type CreativeTvPlayback = {
  playbackId: string;
  postId: string;
  discoverUrl: string;
  title?: string;
  durationSeconds?: number | null;
};

export function creativeTvApiUrl(): string {
  return (process.env.MIXTAPE_CRTV_API_URL?.trim() || DEFAULT_CRTV_API_URL).replace(/\/$/, "");
}

export function creativeTvApiKey(): string | null {
  const key = process.env.MIXTAPE_CRTV_API_KEY?.trim();
  return key || null;
}

export function isCreativeTvConfigured(): boolean {
  return Boolean(creativeTvApiKey());
}

export function parseCreativeTvUrl(raw: string): CreativeTvParsed | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "tv.creativeplatform.xyz" && !hostname.endsWith(".creativeplatform.xyz")) {
      return null;
    }
    const match = url.pathname.match(/^\/discover\/([0-9a-f-]{36})$/i);
    if (!match?.[1]) return null;
    return {
      postId: match[1].toLowerCase(),
      discoverUrl: url.toString()
    };
  } catch {
    return null;
  }
}

export function buildCreativeTvDiscoverUrl(postId: string): string {
  return `https://tv.creativeplatform.xyz/discover/${postId}`;
}

function extractPlaybackId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  if (typeof obj.playbackId === "string" && obj.playbackId) return obj.playbackId;
  if (typeof obj.playback_id === "string" && obj.playback_id) return obj.playback_id;
  if (obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.playbackId === "string" && data.playbackId) return data.playbackId;
    if (typeof data.playback_id === "string" && data.playback_id) return data.playback_id;
  }
  if (obj.asset && typeof obj.asset === "object") {
    const asset = obj.asset as Record<string, unknown>;
    if (typeof asset.playbackId === "string" && asset.playbackId) return asset.playbackId;
  }
  return "";
}

export async function resolvePlaybackByAssetId(postId: string): Promise<CreativeTvPlayback> {
  const apiKey = creativeTvApiKey();
  if (!apiKey) {
    throw new Error("MIXTAPE_CRTV_API_KEY is not configured.");
  }

  const url = `${creativeTvApiUrl()}${CRTV_PLAYBACK_PATH}/${encodeURIComponent(postId)}/playback`;
  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });

  if (response.status === 404) {
    throw new Error("Creative TV asset not found.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Creative TV API authorization failed.");
  }
  if (response.status === 402) {
    throw new Error("Creative TV API payment required.");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Creative TV API error (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json().catch(() => null);
  const playbackId = extractPlaybackId(payload);
  if (!playbackId) {
    throw new Error("Creative TV response missing playbackId.");
  }

  let title: string | undefined;
  let durationSeconds: number | null | undefined;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.title === "string") title = obj.title;
    if (typeof obj.duration === "number") durationSeconds = obj.duration;
    if (typeof obj.durationSeconds === "number") durationSeconds = obj.durationSeconds;
  }

  return {
    playbackId,
    postId,
    discoverUrl: buildCreativeTvDiscoverUrl(postId),
    title,
    durationSeconds
  };
}
