"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onYoutubeIframeApiReady } from "../../lib/youtube-iframe-api";
import {
  resolvePlaybackSource,
  type PlaybackSourceKind,
  type ResolvedPlaybackSource,
  type SongPlaybackFields
} from "../../lib/song-playback";
import { youtubeVideoId } from "../../lib/youtube";

export type MixYtPlayer = {
  destroy: () => void;
  getPlaylistIndex: () => number;
  getPlayerState: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  getVideoData: () => { video_id?: string };
  playVideo?: () => void;
  pauseVideo?: () => void;
  loadVideoById?: (videoId: string) => void;
};

export type MixTrackFields = SongPlaybackFields & {
  title: string;
  artist: string;
  youtubeUrl?: string;
};

export type MixQueueItem = {
  trackIndex: number;
  track: MixTrackFields;
  source: ResolvedPlaybackSource;
  playable: boolean;
};

export type MixPlaybackError = {
  title: string;
  artist: string;
  url?: string;
  videoId?: string;
  message: string;
};

type Options = {
  tracks: MixTrackFields[];
  mixId: number | null;
  ytElementId: string | null;
  initialTrackIndex?: number;
  enabled?: boolean;
  onTrackPlaying?: (trackIndex: number) => void;
  onLastTrackEnded?: () => void;
};

function isPlayableSource(source: ResolvedPlaybackSource): boolean {
  return source.kind !== "link_only";
}

export function useMixPlayback({
  tracks,
  mixId,
  ytElementId,
  initialTrackIndex = 0,
  enabled = true,
  onTrackPlaying,
  onLastTrackEnded
}: Options) {
  const queue = useMemo<MixQueueItem[]>(() => {
    return tracks.map((track, trackIndex) => {
      const source = resolvePlaybackSource(track);
      return {
        trackIndex,
        track,
        source,
        playable: isPlayableSource(source)
      };
    });
  }, [tracks]);

  const playableQueue = useMemo(() => queue.filter((item) => item.playable), [queue]);

  const [queuePosition, setQueuePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [error, setError] = useState<MixPlaybackError | null>(null);

  const ytPlayerRef = useRef<MixYtPlayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixIdRef = useRef(mixId);
  const lastSeekRef = useRef<{ mixId: number | null; trackIndex: number }>({ mixId: null, trackIndex: -1 });
  const onTrackPlayingRef = useRef(onTrackPlaying);
  const onLastTrackEndedRef = useRef(onLastTrackEnded);
  onTrackPlayingRef.current = onTrackPlaying;
  onLastTrackEndedRef.current = onLastTrackEnded;

  const currentItem = playableQueue[queuePosition] ?? null;
  const currentTrackIndex = currentItem?.trackIndex ?? initialTrackIndex;
  const currentSource = currentItem?.source ?? null;
  const currentSourceKind: PlaybackSourceKind | null = currentSource?.kind ?? null;

  const resetPlayback = useCallback(() => {
    setQueuePosition(0);
    setIsPlaying(false);
    setPlayerReady(false);
    setError(null);
    ytPlayerRef.current?.destroy();
    ytPlayerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    lastSeekRef.current = { mixId: null, trackIndex: -1 };
  }, []);

  useEffect(() => {
    if (mixIdRef.current !== mixId) {
      mixIdRef.current = mixId;
      resetPlayback();
    }
  }, [mixId, resetPlayback]);

  useEffect(() => {
    if (!enabled) return;
    const mixChanged = lastSeekRef.current.mixId !== mixId;
    const trackTargetChanged = lastSeekRef.current.trackIndex !== initialTrackIndex;
    if (!mixChanged && !trackTargetChanged) return;

    lastSeekRef.current = { mixId, trackIndex: initialTrackIndex };
    const playableIndex = playableQueue.findIndex((item) => item.trackIndex === initialTrackIndex);
    if (playableIndex >= 0) setQueuePosition(playableIndex);
  }, [enabled, initialTrackIndex, mixId, playableQueue]);

  const advanceQueue = useCallback(() => {
    setError(null);
    setIsPlaying(false);
    setPlayerReady(false);
    ytPlayerRef.current?.destroy();
    ytPlayerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setQueuePosition((current) => {
      if (playableQueue.length === 0) return 0;
      if (current >= playableQueue.length - 1) return current;
      return current + 1;
    });
  }, [playableQueue.length]);

  const skip = useCallback(() => {
    advanceQueue();
  }, [advanceQueue]);

  const notifyTrackPlaying = useCallback((trackIndex: number) => {
    onTrackPlayingRef.current?.(trackIndex);
  }, []);

  // YouTube player setup
  useEffect(() => {
    if (!enabled || !ytElementId || !currentItem || currentSource?.kind !== "youtube") {
      setPlayerReady(false);
      return;
    }

    const videoId = currentSource.youtubeVideoId;
    if (!videoId) return;

    let cancelled = false;

    const setup = () => {
      if (cancelled || !window.YT?.Player) return;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = new window.YT.Player(ytElementId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (!cancelled) setPlayerReady(true);
          },
          onError: () => {
            if (cancelled) return;
            setError({
              title: currentItem.track.title,
              artist: currentItem.track.artist,
              url: currentItem.track.youtubeUrl,
              videoId,
              message: "This YouTube video is unavailable or cannot be embedded."
            });
            setIsPlaying(false);
          },
          onStateChange: (event: { data: number }) => {
            if (!window.YT) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setError(null);
              notifyTrackPlaying(currentItem.trackIndex);
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.BUFFERING ||
              event.data === window.YT.PlayerState.CUED ||
              event.data === window.YT.PlayerState.UNSTARTED
            ) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (queuePosition >= playableQueue.length - 1) {
                onLastTrackEndedRef.current?.();
              }
              advanceQueue();
            }
          }
        }
      }) as MixYtPlayer;
    };

    if (window.YT?.Player) {
      setup();
    } else {
      const unsubscribe = onYoutubeIframeApiReady(setup);
      return () => {
        cancelled = true;
        unsubscribe();
        ytPlayerRef.current?.destroy();
        ytPlayerRef.current = null;
        setPlayerReady(false);
      };
    }

    return () => {
      cancelled = true;
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
      setPlayerReady(false);
    };
  }, [
    advanceQueue,
    currentItem,
    currentSource,
    enabled,
    notifyTrackPlaying,
    playableQueue.length,
    queuePosition,
    ytElementId
  ]);

  // Pinata / hosted audio
  useEffect(() => {
    if (!enabled || !currentItem || currentSource?.kind !== "pinata") {
      return;
    }

    const audioUrl = currentSource.audioUrl ?? currentItem.track.audioUrl?.trim();
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onPlay = () => {
      setIsPlaying(true);
      notifyTrackPlaying(currentItem.trackIndex);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (queuePosition >= playableQueue.length - 1) {
        onLastTrackEndedRef.current?.();
      }
      advanceQueue();
    };
    const onError = () => {
      setError({
        title: currentItem.track.title,
        artist: currentItem.track.artist,
        message: "Could not play hosted audio for this track."
      });
      setIsPlaying(false);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    setPlayerReady(true);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
      setPlayerReady(false);
    };
  }, [advanceQueue, currentItem, currentSource, enabled, notifyTrackPlaying, playableQueue.length, queuePosition]);

  // Iframe / livepeer tracks are ready immediately
  useEffect(() => {
    if (!enabled || !currentItem) return;
    if (currentSource?.kind === "iframe" || currentSource?.kind === "livepeer") {
      setPlayerReady(true);
    }
  }, [currentItem, currentSource, enabled]);

  const postIframeCommand = useCallback((command: "playVideo" | "pauseVideo") => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "*"
    );
  }, []);

  const play = useCallback(() => {
    setError(null);
    if (!currentItem || !currentSource) return;

    if (currentSource.kind === "youtube") {
      const player = ytPlayerRef.current;
      if (!player?.playVideo) {
        setError({
          title: currentItem.track.title,
          artist: currentItem.track.artist,
          message: "Player is still loading. Please try again in a moment."
        });
        return;
      }
      player.playVideo();
      return;
    }

    if (currentSource.kind === "pinata") {
      const audio = audioRef.current;
      if (!audio) {
        setError({
          title: currentItem.track.title,
          artist: currentItem.track.artist,
          message: "Audio is still loading. Please try again in a moment."
        });
        return;
      }
      void audio.play().catch(() => {
        setError({
          title: currentItem.track.title,
          artist: currentItem.track.artist,
          message: "Playback was blocked by the browser."
        });
      });
      return;
    }

    if (currentSource.kind === "iframe") {
      postIframeCommand("playVideo");
      setIsPlaying(true);
      notifyTrackPlaying(currentItem.trackIndex);
      return;
    }

    if (currentSource.kind === "livepeer") {
      setIsPlaying(true);
      notifyTrackPlaying(currentItem.trackIndex);
    }
  }, [currentItem, currentSource, notifyTrackPlaying, postIframeCommand]);

  const pause = useCallback(() => {
    if (currentSource?.kind === "youtube") {
      ytPlayerRef.current?.pauseVideo?.();
      return;
    }
    if (currentSource?.kind === "pinata") {
      audioRef.current?.pause();
      return;
    }
    if (currentSource?.kind === "iframe") {
      postIframeCommand("pauseVideo");
      setIsPlaying(false);
      return;
    }
    if (currentSource?.kind === "livepeer") {
      setIsPlaying(false);
    }
  }, [currentSource, postIframeCommand]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const nowPlaying = currentItem?.track ?? null;
  const canPlay = playableQueue.length > 0;
  const showYoutubeEmbed = currentSourceKind === "youtube" && Boolean(ytElementId);
  const iframeUrl = currentSourceKind === "iframe" ? currentSource?.iframeUrl : undefined;
  const livepeerPlaybackId =
    currentSourceKind === "livepeer" ? currentSource?.livepeerPlaybackId : undefined;

  return {
    queue,
    playableQueue,
    queuePosition,
    currentTrackIndex,
    currentItem,
    currentSourceKind,
    nowPlaying,
    isPlaying,
    playerReady,
    canPlay,
    error,
    showYoutubeEmbed,
    iframeUrl,
    livepeerPlaybackId,
    ytPlayerRef,
    iframeRef,
    setIsPlaying,
    play,
    pause,
    togglePlay,
    skip,
    setQueuePosition,
    youtubeVideoIdForCurrent: currentSource?.youtubeVideoId ?? youtubeVideoId(currentItem?.track.youtubeUrl ?? "")
  };
}
