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
};

const TEXT_CARD_DURATION_MS = 12000;

export default function StationPlayer({ stationName, segments }: Props) {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textTimerRef = useRef<number | null>(null);

  const queue = useMemo(() => segments.filter((segment) => segmentIsPlayable(segment)), [segments]);
  const current = queue[index] ?? null;

  const advance = useCallback(() => {
    setIndex((prev) => (queue.length === 0 ? 0 : (prev + 1) % queue.length));
  }, [queue.length]);

  function pauseYoutube() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "*"
    );
  }

  function playYoutube() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "*"
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.data !== "string") return;
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
      // iframe src updates via React; tell it to start playing
      window.setTimeout(playYoutube, 800);
      return;
    }

    if (audioPlayableUrl(current)) {
      pauseYoutube();
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = audioPlayableUrl(current);
      void audio.play().catch(() => undefined);
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
    // Prime the audio element so subsequent `.play()` calls aren't blocked
    const audio = audioRef.current;
    if (audio) {
      audio.muted = true;
      void audio.play().then(() => {
        audio.pause();
        audio.muted = false;
      }).catch(() => undefined);
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
          origin: typeof window === "undefined" ? undefined : window.location.origin
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
          />
        ) : null}
        <audio ref={audioRef} onEnded={advance} controls={!isYoutube} />
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
  if (segment.kind === "text") return true;
  return Boolean(segment.audioUrl);
}
