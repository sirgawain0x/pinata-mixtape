export function youtubeVideoId(url: string): string {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replaceAll("/", "");
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return id;
      const segments = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = segments.findIndex((segment) => segment === "embed");
      if (embedIndex >= 0 && segments[embedIndex + 1]) {
        return segments[embedIndex + 1];
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
