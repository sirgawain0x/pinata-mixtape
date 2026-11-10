export type SocialPlatform = "x" | "lens";

export const SOCIAL_DESTINATIONS = {
  x: { name: "X / Twitter", composer: "https://twitter.com/intent/tweet" },
  lens: { name: "Lens", composer: "https://hey.xyz/", clientName: "Hey" }
} as const;

/** Only offer playlist links that recipients can open outside the local machine. */
export function shareableOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
      host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "[::1]" || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    return url.origin;
  } catch { return null; }
}

export function publicPlaylistShareUrl(mix: { id: number; isPublic: boolean; slug: string }, origin: string): string | null {
  const base = shareableOrigin(origin);
  if (!mix.isPublic || !base) return null;
  return mix.slug
    ? `${base}/app/m/${encodeURIComponent(mix.slug)}`
    : `${base}/app?mix=${mix.id}`;
}

export function socialPostText(text: string, playlistUrl?: string | null): string {
  return [text.trim(), playlistUrl].filter(Boolean).join("\n\n");
}

/** Intent URLs open a reviewable composer. They never confirm publication. */
export function socialComposerUrl(platform: SocialPlatform, text: string, playlistUrl?: string | null): string {
  const url = new URL(SOCIAL_DESTINATIONS[platform].composer);
  // Hey's NewPost reads text/url on the home route; /intent/post is not a supported route.
  url.searchParams.set("text", socialPostText(text, playlistUrl));
  return url.toString();
}
