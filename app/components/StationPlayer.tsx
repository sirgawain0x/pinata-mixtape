"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { youtubeEmbedUrl, youtubeVideoId } from "../../lib/youtube";

type Segment = {
  id: number;
  position: number;
  kind: "music" | "voice" | "upload" | "text" | "podcast";
  title: string;
  body: string;
  audioCid: string;
  audioUrl: string;
  durationSeconds: number | null;
  song?: {
    title: string;
    artist: string;
    youtubeUrl: string;
  } | null;
};

type Props = {
  stationName: string;
  segments: Segment[];
  /** From the incoming request so YouTube embed `src` matches SSR and client (avoids hydration mismatch). */
  embedOrigin?: string;
};

const TEXT_CARD_DURATION_MS = 12000;
/** postMessage target for YouTube embed commands (avoid `"*"` — reduces internal API races). */
const YOUTUBE_EMBED_ORIGIN = "https://www.youtube.com";

/** Hostnames allowed for iframe playerApi postMessage origins (blocks e.g. attacker-youtube.com). */
const TRUSTED_YOUTUBE_MESSAGE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "m.youtube.com"
]);

function isTrustedYoutubeMessageOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return TRUSTED_YOUTUBE_MESSAGE_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

export default function StationPlayer({ stationName, segments, embedOrigin = "" }: Props) {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textTimerRef = useRef<number | null>(null);
  const currentRef = useRef<(typeof segments)[number] | null>(null);
  const audioSourceKeyRef = useRef("");
  const lastAudioSegmentIdRef = useRef<number | null>(null);

  const queue = useMemo(() => segments.filter((segment) => segmentIsPlayable(segment)), [segments]);
  const current = queue[index] ?? null;
  currentRef.current = current;

  const advance = useCallback(() => {
    setIndex((prev) => (queue.length === 0 ? 0 : (prev + 1) % queue.length));
  }, [queue.length]);

  function pauseYoutube() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      YOUTUBE_EMBED_ORIGIN
    );
  }

  function playYoutube() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      YOUTUBE_EMBED_ORIGIN
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.data !== "string") return;
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
      const origin = typeof event.origin === "string" ? event.origin : "";
      if (!isTrustedYoutubeMessageOrigin(origin)) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.event === "onStateChange" && data.info === 0) advance();
      } catch {
        // ignore non-JSON postMessage
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [advance]);

  useEffect(() => {
    if (textTimerRef.current) {
      window.clearTimeout(textTimerRef.current);
      textTimerRef.current = null;
    }
    if (!started || !current) return;

    if (current.kind === "music" && current.song?.youtubeUrl) {
      pauseAudio();
      // URL may include autoplay=1 after Start; postMessage is a fallback once the iframe API is ready.
      window.setTimeout(playYoutube, 1200);
      return;
    }

    if (audioPlayableUrl(current)) {
      pauseYoutube();
      const audio = audioRef.current;
      if (!audio) return;
      audio.muted = false;
      audio.volume = 1;
      const url = audioPlayableUrl(current);
      const sourceKey = `${current.id}:${url}`;
      if (audioSourceKeyRef.current !== sourceKey) {
        audioSourceKeyRef.current = sourceKey;
        audio.src = url;
        audio.load();
      } else if (lastAudioSegmentIdRef.current !== current.id) {
        audio.currentTime = 0;
      }
      lastAudioSegmentIdRef.current = current.id;
      const tryPlay = () => {
        void audio.play().catch(() => undefined);
      };
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) tryPlay();
      else {
        audio.addEventListener("canplay", tryPlay, { once: true });
        tryPlay();
      }
      return;
    }

    if (current.kind === "text") {
      pauseYoutube();
      pauseAudio();
      textTimerRef.current = window.setTimeout(advance, TEXT_CARD_DURATION_MS);
    }
  }, [advance, current, started]);

  function pauseAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }

  function start() {
    setStarted(true);
    const audio = audioRef.current;
    if (audio) {
      // Do not use muted "priming": play() with no src rejects and leaves muted=true, so listeners hear nothing.
      audio.muted = false;
      audio.volume = 1;
    }
  }

  if (queue.length === 0) {
    return (
      <div className="player-empty">
        <p>No segments yet. The host hasn’t programmed this station.</p>
      </div>
    );
  }

  const isYoutube = current?.kind === "music" && Boolean(current.song?.youtubeUrl);
  const embedSrc =
    isYoutube && current?.song
      ? youtubeEmbedUrl(current.song.youtubeUrl, {
          jsApi: true,
          origin: embedOrigin || undefined,
          autoplay: started
        })
      : "";

  return (
    <div className="station-player">
      {!started ? (
        <button className="start-station" onClick={start} type="button">
          ▶ Start {stationName}
        </button>
      ) : null}

      <div className="now-playing">
        <p className="eyebrow">Now playing</p>
        <h3>{current?.title || segmentLabel(current)}</h3>
        {current?.song ? <small>{`${current.song.artist} — ${current.song.title}`}</small> : null}
        {current?.kind === "text" ? <p className="text-card">{current.body}</p> : null}
      </div>

      <div className="player-stage">
        {isYoutube ? (
          <iframe
            key={`yt-${current?.id}`}
            ref={iframeRef}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            src={embedSrc}
            title="station video"
            // Extensions (e.g. “mega-iframe”) inject attributes on iframes and trigger hydration warnings.
            suppressHydrationWarning
          />
        ) : null}
        <audio
          ref={audioRef}
          controls={!isYoutube}
          onEnded={advance}
          onError={() => {
            const c = currentRef.current;
            if (c?.kind === "text" && c.body?.trim()) {
              if (textTimerRef.current) window.clearTimeout(textTimerRef.current);
              textTimerRef.current = window.setTimeout(advance, TEXT_CARD_DURATION_MS);
            } else {
              advance();
            }
          }}
        />
      </div>

      <ol className="queue">
        {queue.map((segment, segmentIndex) => (
          <li key={segment.id} className={segmentIndex === index ? "active" : ""}>
            <button onClick={() => setIndex(segmentIndex)} type="button">
              <span className="queue-kind">{segment.kind}</span>
              <span>{segment.title || segmentLabel(segment)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function segmentLabel(segment: Segment | null): string {
  if (!segment) return "";
  switch (segment.kind) {
    case "music":
      return segment.song ? `${segment.song.artist} — ${segment.song.title}` : "Music";
    case "voice":
      return "Voice update";
    case "upload":
      return "Audio clip";
    case "text":
      return "News card";
    case "podcast":
      return "Podcast episode";
    default:
      return "Segment";
  }
}

function audioPlayableUrl(segment: Segment): string {
  if (segment.kind === "music") {
    if (segment.song?.youtubeUrl) return "";
    return segment.audioUrl;
  }
  if (segment.kind === "text") {
    return segment.audioUrl;
  }
  return segment.audioUrl;
}

function segmentIsPlayable(segment: Segment): boolean {
  if (segment.kind === "music") {
    if (segment.song?.youtubeUrl && youtubeVideoId(segment.song.youtubeUrl)) return true;
    if (segment.audioUrl) return true;
    return false;
  }
  // Keep text cards in rotation even when narration audio is missing.
  // This avoids "disappearing" updates when custom TTS generation fails.
  if (segment.kind === "text") return Boolean(segment.body?.trim()) || Boolean(segment.audioUrl);
  return Boolean(segment.audioUrl);
}
