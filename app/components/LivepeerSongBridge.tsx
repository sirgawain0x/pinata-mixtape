"use client";

import type { Src } from "@livepeer/core/media";
import { Container, Root, Video } from "@livepeer/react/player";
import { useEffect, useRef } from "react";

type Props = {
  playbackId: string;
  isPlaying: boolean;
  onTimeUpdate?: (current: number, duration: number) => void;
  onPlayingChange?: (playing: boolean) => void;
};

export default function LivepeerSongBridge({ playbackId, isPlaying, onTimeUpdate, onPlayingChange }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hlsSrc = `https://livepeercdn.com/hls/${playbackId}/index.m3u8` as `${string}m3u8`;
  const livepeerSrc = { type: "hls", src: hlsSrc } as Src;

  useEffect(() => {
    const video = shellRef.current?.querySelector("video");
    if (!video) return;

    if (isPlaying) {
      void video.play().catch(() => onPlayingChange?.(false));
    } else {
      video.pause();
    }
  }, [isPlaying, onPlayingChange, playbackId]);

  useEffect(() => {
    const video = shellRef.current?.querySelector("video");
    if (!video) return;

    const onTime = () => onTimeUpdate?.(video.currentTime, video.duration || 0);
    const onPlay = () => onPlayingChange?.(true);
    const onPause = () => onPlayingChange?.(false);

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [onPlayingChange, onTimeUpdate, playbackId]);

  return (
    <div className="song-livepeer-shell" ref={shellRef}>
      <Root src={[livepeerSrc]}>
        <Container>
          <Video />
        </Container>
      </Root>
    </div>
  );
}
