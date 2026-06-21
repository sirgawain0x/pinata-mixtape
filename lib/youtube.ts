export function youtubeVideoId(url: string): string {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.replaceAll("/", "").split("?")[0] ?? "";
    }

    if (host === "youtube.com" || host === "music.youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id) return id;

      const segments = parsed.pathname.split("/").filter(Boolean);
      const shortsIndex = segments.findIndex((segment) => segment === "shorts");
      if (shortsIndex >= 0 && segments[shortsIndex + 1]) {
        return segments[shortsIndex + 1];
      }

      const embedIndex = segments.findIndex((segment) => segment === "embed");
      if (embedIndex >= 0 && segments[embedIndex + 1]) {
        return segments[embedIndex + 1];
      }

      const liveIndex = segments.findIndex((segment) => segment === "live");
      if (liveIndex >= 0 && segments[liveIndex + 1]) {
        return segments[liveIndex + 1];
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function youtubeEmbedUrl(
  url: string,
  options: { jsApi?: boolean; origin?: string; autoplay?: boolean } = {}
): string {
  const id = youtubeVideoId(url);
  if (!id) return "";
  const params = new URLSearchParams();
  if (options.jsApi) {
    params.set("enablejsapi", "1");
    if (options.origin) params.set("origin", options.origin);
  }
  if (options.autoplay) params.set("autoplay", "1");
  const query = params.toString();
  return query ? `https://www.youtube.com/embed/${id}?${query}` : `https://www.youtube.com/embed/${id}`;
}

export function youtubePlaylistEmbed(urls: string[]): string {
  const ids = urls.map(youtubeVideoId).filter(Boolean);
  if (ids.length === 0) return "";
  if (ids.length === 1) return `https://www.youtube.com/embed/${ids[0]}`;
  return `https://www.youtube.com/embed/${ids[0]}?playlist=${ids.slice(1).join(",")}`;
}
