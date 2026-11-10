export function publicRecordingUrl(value?: string): URL | undefined {
  if (!value?.trim()) return;
  try {
    const url = new URL(value.trim());
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url;
  } catch {
    // Invalid links fall back to discovery.
  }
}

export function buildYoutubeSearchUrl(title: string, artist: string): string {
  const query = [title.trim(), artist.trim()].filter(Boolean).join(" ");
  return query ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : "";
}

export function isYoutubeSearchUrl(value?: string): boolean {
  const url = publicRecordingUrl(value);
  return Boolean(url && ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname) && url.pathname === "/results");
}

export function preferredRecordingLink(title: string, artist: string, ...candidates: (string | undefined)[]): string {
  const links = candidates.flatMap((value) => publicRecordingUrl(value)?.toString() ?? []);
  return links.find((url) => !isYoutubeSearchUrl(url)) ?? links[0] ?? buildYoutubeSearchUrl(title, artist);
}

/** Convert known player URLs back to song links that can open in the streaming apps. */
export function streamingAppLinks(...candidates: (string | undefined)[]): { appleMusic?: string; spotify?: string } {
  const links: { appleMusic?: string; spotify?: string } = {};
  for (const candidate of candidates) {
    const embed = publicRecordingUrl(recordingEmbedUrl(candidate));
    if (embed?.hostname === "embed.music.apple.com" && !links.appleMusic) {
      links.appleMusic = `https://music.apple.com${embed.pathname}${embed.search}`;
    }
    if (embed?.hostname === "open.spotify.com" && !links.spotify) {
      links.spotify = `https://open.spotify.com${embed.pathname.replace(/^\/embed/, "")}`;
    }
  }
  return links;
}

export function recordingEmbedUrl(value?: string): string | undefined {
  const url = publicRecordingUrl(value);
  if (!url) return;
  if (url.hostname === "open.spotify.com") {
    const id = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?track\/([A-Za-z0-9]{22})\/?$/)?.[1];
    if (id) return `https://open.spotify.com/embed/track/${id}`;
  }
  if (["music.apple.com", "embed.music.apple.com"].includes(url.hostname)) {
    const songPath = /^\/[a-z]{2}\/song\/(?:[^/]+\/)?\d+\/?$/i.test(url.pathname);
    const albumTrack = /^\/[a-z]{2}\/album\/(?:[^/]+\/)?\d+\/?$/i.test(url.pathname) && /^\d+$/.test(url.searchParams.get("i") ?? "");
    if (songPath || albumTrack) {
      const embed = new URL(url.pathname, "https://embed.music.apple.com");
      if (albumTrack) embed.searchParams.set("i", url.searchParams.get("i")!);
      return embed.toString();
    }
  }
  if (["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com"].includes(url.hostname) &&
    /^\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i.test(url.pathname) &&
    !/^\/(?:discover|search|charts|you|pages|stations|tags|upload)\//i.test(url.pathname) &&
    !/\/(?:tracks|sets|likes|reposts|albums|popular-tracks|spotlight)\/?$/i.test(url.pathname)) {
    const track = new URL(url.pathname, "https://soundcloud.com");
    const widget = new URL("https://w.soundcloud.com/player/");
    widget.searchParams.set("url", track.toString());
    return widget.toString();
  }
}
