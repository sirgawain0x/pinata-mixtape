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
  playerReady: boolean;
  progress: number;
  duration: number;
  error: string | null;
  togglePlay: () => void;
  openOutbound: () => void;
  seek: (seconds: number) => void;
  outboundUrl?: string;
  livepeerPlaybackId?: string;
  youtubeContainerId?: string;
  iframeUrl?: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onLivepeerTime?: (current: number, duration: number) => void;
  onLivepeerPlaying?: (playing: boolean) => void;
};

export function useSongPlayback({ song, embedOrigin = "", onPlayingChange, onProgressChange }: Props): SongPlaybackControls {
  const source = useMemo(() => resolvePlaybackSource(song), [song]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YtPlayerInstance | null>(null);
  const ytContainerId = useMemo(() => `yt-song-${source.youtubeVideoId || "none"}`, [source.youtubeVideoId]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(source.kind === "link_only");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onLivepeerTime = useCallback((current: number, dur: number) => {
    setProgress(current);
    setDuration(dur);
  }, []);

  const onLivepeerPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

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
    setPlayerReady(source.kind === "link_only");
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setError(null);
  }, [source.kind, source.youtubeVideoId, pinataAudioUrl, source.iframeUrl, source.livepeerPlaybackId]);

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
    setPlayerReady(true);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
      setPlayerReady(false);
    };
  }, [pinataAudioUrl, source.kind]);

  useEffect(() => {
    if (source.kind !== "youtube" || !source.youtubeVideoId) return;

    let cancelled = false;

    const setup = () => {
      if (cancelled || !window.YT?.Player) return;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = new window.YT!.Player(ytContainerId, {
        height: "0",
        width: "0",
        videoId: source.youtubeVideoId,
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (!cancelled) setPlayerReady(true);
          },
          onError: () => {
            if (!cancelled) {
              setError(
                `YouTube video unavailable${source.youtubeVideoId ? ` (${source.youtubeVideoId})` : ""}. Check the URL or embedding settings.`
              );
              setIsPlaying(false);
            }
          },
          onStateChange: (event: { data: number }) => {
            const YT = window.YT;
            if (!YT) return;
            if (event.data === YT.PlayerState.PLAYING) setIsPlaying(true);
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) setIsPlaying(false);
          }
        }
      }) as unknown as YtPlayerInstance;
    };

    setPlayerReady(false);

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
      cancelled = true;
      window.clearInterval(tick);
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
      setPlayerReady(false);
    };
  }, [source.kind, source.youtubeVideoId, ytContainerId]);

  useEffect(() => {
    if (source.kind === "iframe" && source.iframeUrl) {
      setPlayerReady(true);
    }
    if (source.kind === "livepeer" && source.livepeerPlaybackId) {
      setPlayerReady(true);
    }
  }, [source]);

  const openOutbound = useCallback(() => {
    if (!source.outboundUrl) return;
    window.open(source.outboundUrl, "_blank", "noopener,noreferrer");
  }, [source.outboundUrl]);

  const togglePlay = useCallback(() => {
    setError(null);
    if (source.kind === "link_only") {
      openOutbound();
      return;
    }
    if (source.kind === "pinata") {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) void audio.play().catch(() => setError("Playback blocked."));
      else audio.pause();
      return;
    }
    if (source.kind === "youtube") {
      const player = ytPlayerRef.current;
      if (!player) {
        setError("Player still loading. Try again in a moment.");
        return;
      }
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
    }
  }, [isPlaying, openOutbound, source.kind]);

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
    playerReady,
    progress,
    duration,
    error,
    togglePlay,
    openOutbound,
    seek,
    outboundUrl: source.outboundUrl,
    livepeerPlaybackId: source.livepeerPlaybackId,
    youtubeContainerId: source.kind === "youtube" ? ytContainerId : undefined,
    iframeUrl: source.kind === "iframe" ? source.iframeUrl : undefined,
    audioRef,
    iframeRef,
    onLivepeerTime,
    onLivepeerPlaying
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
        ref={controls.iframeRef}
        src={iframeUrl}
        title="Embedded playback"
      />
    );
  }

  return null;
}
