"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { mountYoutubePlayer } from "../../lib/youtube-iframe-api";
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
  const ytContainerId = useId();
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

    const shell = document.getElementById(ytContainerId);
    if (!shell) return;

    let cancelled = false;
    const reportError = (message: string) => {
      if (cancelled) return;
      setError(message);
      setIsPlaying(false);
    };

    const unmount = mountYoutubePlayer(shell, source.youtubeVideoId, song.title ?? "YouTube player", {
      onReady: ({ target }) => {
        if (cancelled) return;
        ytPlayerRef.current = target as YtPlayerInstance;
        setPlayerReady(true);
        setError(null);
      },
      onError: () => reportError("This YouTube video is unavailable or cannot be embedded."),
      onAutoplayBlocked: () => reportError("Your browser blocked playback. Try the YouTube listening link."),
      onStateChange: ({ data }) => {
        const state = window.YT?.PlayerState;
        if (cancelled || !state) return;
        if (data === state.PLAYING) {
          setIsPlaying(true);
          setError(null);
        }
        if (data === state.PAUSED || data === state.ENDED) setIsPlaying(false);
      }
    }, () => reportError("Could not connect to the YouTube controls. Try the YouTube listening link."));

    const tick = window.setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player) return;
      setProgress(player.getCurrentTime());
      setDuration(player.getDuration() || 0);
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      ytPlayerRef.current = null;
      unmount();
      setPlayerReady(false);
    };
  }, [song.title, source.kind, source.youtubeVideoId, ytContainerId]);

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
      if (!player) return;
      const state = player.getPlayerState();
      if (state === window.YT?.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
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
  showVideo = false,
  onLivepeerTime,
  onLivepeerPlaying
}: {
  controls: SongPlaybackControls;
  showVideo?: boolean;
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
        showControls={showVideo}
      />
    );
  }

  if (sourceKind === "youtube" && youtubeContainerId) {
    return (
      <div className={showVideo ? "song-video-shell" : "song-yt-shell"} aria-hidden={showVideo ? undefined : true}>
        <div id={youtubeContainerId} />
      </div>
    );
  }

  if (sourceKind === "iframe" && iframeUrl) {
    return (
      <iframe
        allow="autoplay; encrypted-media"
        className={showVideo ? "song-provider-embed" : "song-iframe-embed"}
        ref={controls.iframeRef}
        src={iframeUrl}
        title="Embedded playback"
      />
    );
  }

  return null;
}
