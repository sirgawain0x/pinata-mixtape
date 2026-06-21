type YoutubeReadyHandler = () => void;

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: {
      Player: new (elementId: string, options: unknown) => unknown;
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
let scriptInjected = false;

function flushHandlers() {
  if (!window.YT?.Player) return;
  for (const handler of pendingHandlers) {
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
export function onYoutubeIframeApiReady(handler: YoutubeReadyHandler): () => void {
  if (typeof window === "undefined") return () => {};

  pendingHandlers.add(handler);

  if (window.YT?.Player) {
    handler();
    return () => pendingHandlers.delete(handler);
  }

  if (!scriptInjected) {
    scriptInjected = true;
    ensurePreviousCallbackChained();
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }
  } else {
    ensurePreviousCallbackChained();
  }

  return () => pendingHandlers.delete(handler);
}
