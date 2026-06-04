"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolvePlaybackSource, type PlaybackSourceKind, type SongPlaybackFields } from "../../lib/song-playback";
import LivepeerSongBridge from "../components/LivepeerSongBridge";

type Props = {
  song: SongPlaybackFields;
  embedOrigin?: string;
  onPlayingChange?: (playing: boolean) => void;
  onProgressChange?: (progress: number) => void;
};

type YtPlayerInstance = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
};

export type SongPlaybackControls = {
  sourceKind: PlaybackSourceKind;
  isPlaying: boolean;
  progress: number;
  duration: number;
  error: string | null;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  outboundUrl?: string;
  livepeerPlaybackId?: string;
  youtubeContainerId?: string;
  iframeUrl?: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
};

export function useSongPlayback({ song, embedOrigin = "", onPlayingChange, onProgressChange }: Props): SongPlaybackControls {
  const source = useMemo(() => resolvePlaybackSource(song), [song]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YtPlayerInstance | null>(null);
  const ytContainerId = useMemo(() => `yt-song-${source.youtubeVideoId || "none"}`, [source.youtubeVideoId]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pinataAudioUrl = useMemo(() => {
    if (source.kind !== "pinata") return "";
    return song.audioUrl?.trim() || source.audioUrl || "";
  }, [song.audioUrl, source]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    onProgressChange?.(progress);
  }, [progress, onProgressChange]);

  useEffect(() => {
    if (source.kind !== "pinata" || !pinataAudioUrl) return;
    const audio = new Audio(pinataAudioUrl);
    audioRef.current = audio;

    const onTime = () => {
      setProgress(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    const onError = () => setError("Could not play hosted audio.");

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [pinataAudioUrl, source.kind]);

  useEffect(() => {
    if (source.kind !== "youtube" || !source.youtubeVideoId) return;

    const setup = () => {
      if (!window.YT?.Player) return;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = new window.YT!.Player(ytContainerId, {
        height: "0",
        width: "0",
        videoId: source.youtubeVideoId,
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1 },
        events: {
          onStateChange: (event: { data: number }) => {
            const YT = window.YT;
            if (!YT) return;
            if (event.data === YT.PlayerState.PLAYING) setIsPlaying(true);
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) setIsPlaying(false);
          }
        }
      }) as unknown as YtPlayerInstance;
    };

    if (window.YT?.Player) {
      setup();
    } else {
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = setup;
    }

    const tick = window.setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player?.getCurrentTime) return;
      setProgress(player.getCurrentTime());
      setDuration(player.getDuration() || 0);
    }, 500);

    return () => {
      window.clearInterval(tick);
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    };
  }, [source.kind, source.youtubeVideoId, ytContainerId]);

  const togglePlay = useCallback(() => {
    setError(null);
    if (source.kind === "pinata") {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) void audio.play().catch(() => setError("Playback blocked."));
      else audio.pause();
      return;
    }
    if (source.kind === "youtube") {
      const player = ytPlayerRef.current;
      if (!player) return;
      const state = player.getPlayerState();
      if (state === window.YT?.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
      return;
    }
    if (source.kind === "iframe" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: isPlaying ? "pauseVideo" : "playVideo", args: [] }),
        "*"
      );
      setIsPlaying((prev) => !prev);
      return;
    }
    if (source.kind === "livepeer") {
      setIsPlaying((prev) => !prev);
      return;
    }
  }, [isPlaying, source.kind]);

  const seek = useCallback(
    (seconds: number) => {
      if (source.kind === "pinata") {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = seconds;
        setProgress(seconds);
      }
      if (source.kind === "youtube") {
        const player = ytPlayerRef.current as YtPlayerInstance & { seekTo?: (s: number, a: boolean) => void };
        player?.seekTo?.(seconds, true);
        setProgress(seconds);
      }
    },
    [source.kind]
  );

  return {
    sourceKind: source.kind,
    isPlaying,
    progress,
    duration,
    error,
    togglePlay,
    seek,
    outboundUrl: source.outboundUrl,
    livepeerPlaybackId: source.livepeerPlaybackId,
    youtubeContainerId: source.kind === "youtube" ? ytContainerId : undefined,
    iframeUrl: source.kind === "iframe" ? source.iframeUrl : undefined,
    audioRef
  };
}

export function SongPlaybackMedia({
  controls,
  onLivepeerTime,
  onLivepeerPlaying
}: {
  controls: SongPlaybackControls;
  embedOrigin?: string;
  onLivepeerTime?: (current: number, duration: number) => void;
  onLivepeerPlaying?: (playing: boolean) => void;
}) {
  const { sourceKind, livepeerPlaybackId, youtubeContainerId, iframeUrl, isPlaying } = controls;

  if (sourceKind === "livepeer" && livepeerPlaybackId) {
    return (
      <LivepeerSongBridge
        isPlaying={isPlaying}
        onPlayingChange={onLivepeerPlaying}
        onTimeUpdate={onLivepeerTime}
        playbackId={livepeerPlaybackId}
      />
    );
  }

  if (sourceKind === "youtube" && youtubeContainerId) {
    return (
      <div className="song-yt-shell" aria-hidden="true">
        <div id={youtubeContainerId} />
      </div>
    );
  }

  if (sourceKind === "iframe" && iframeUrl) {
    return (
      <iframe
        allow="autoplay; encrypted-media"
        className="song-iframe-embed"
        src={iframeUrl}
        title="Embedded playback"
      />
    );
  }

  return null;
}
