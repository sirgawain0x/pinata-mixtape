type YoutubeReadyHandler = () => void;
type YoutubePlayerEvents = {
  onReady: (event: { target: unknown }) => void;
  onError: () => void;
  onStateChange: (event: { data: number }) => void;
  onAutoplayBlocked?: () => void;
};

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: {
      Player: new (element: string | HTMLElement, options: unknown) => unknown;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
  }
}

const pendingHandlers = new Set<YoutubeReadyHandler>();
let callbackInstalled = false;
const apiScriptUrl = "https://www.youtube.com/iframe_api";

function flushHandlers() {
  if (!window.YT?.Player) return;
  const handlers = [...pendingHandlers];
  pendingHandlers.clear();
  for (const handler of handlers) {
    handler();
  }
}

function ensurePreviousCallbackChained() {
  const previous = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    previous?.();
    flushHandlers();
  };
}

/** Register a callback for when the YouTube IFrame API is ready. Returns unsubscribe. */
function onYoutubeIframeApiReady(handler: YoutubeReadyHandler): () => void {
  if (window.YT?.Player) {
    handler();
    return () => {};
  }

  pendingHandlers.add(handler);
  if (!callbackInstalled) {
    callbackInstalled = true;
    ensurePreviousCallbackChained();
  }

  if (!document.querySelector(`script[src="${apiScriptUrl}"]`)) {
    const script = document.createElement("script");
    script.src = apiScriptUrl;
    script.addEventListener("error", () => script.remove(), { once: true });
    document.body.appendChild(script);
  }

  return () => pendingHandlers.delete(handler);
}

export function mountYoutubePlayer(
  shell: HTMLElement,
  videoId: string,
  title: string,
  events: YoutubePlayerEvents,
  onConnectionTimeout: () => void
): () => void {
  // Keep YouTube's own controls usable while the JavaScript API connects.
  const iframe = document.createElement("iframe");
  const url = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
  url.search = new URLSearchParams({
    enablejsapi: "1",
    origin: window.location.origin,
    playsinline: "1",
    rel: "0"
  }).toString();
  iframe.src = url.toString();
  iframe.title = title;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  iframe.allowFullscreen = true;
  shell.replaceChildren(iframe);

  const timeout = window.setTimeout(onConnectionTimeout, 12_000);
  let player: { destroy: () => void } | undefined;
  const unsubscribe = onYoutubeIframeApiReady(() => {
    if (!window.YT?.Player) return;
    player = new window.YT.Player(iframe, {
      events: {
        ...events,
        onReady: (event: { target: unknown }) => {
          window.clearTimeout(timeout);
          events.onReady(event);
        },
        onError: () => {
          window.clearTimeout(timeout);
          events.onError();
        }
      }
    }) as typeof player;
  });

  return () => {
    window.clearTimeout(timeout);
    unsubscribe();
    player?.destroy();
    iframe.remove();
  };
}
