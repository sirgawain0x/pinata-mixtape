"use client";

import { useMemo } from "react";
import CassettePlayer from "./CassettePlayer";
import { SongPlaybackMedia, useSongPlayback } from "../hooks/useSongPlayback";
import type { SongPlaybackFields } from "../../lib/song-playback";

export type SongPlayerSong = SongPlaybackFields & {
  id: number;
  title: string;
  artist: string;
  releaseYear?: string;
  moodTags?: string[];
  sceneTags?: string[];
  creativeTvUrl?: string;
  musicbrainzUrl?: string;
  youtubeUrl?: string;
  listenUrl?: string;
};

type Props = {
  song: SongPlayerSong;
  embedOrigin?: string;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SongPlayerShell({ song, embedOrigin = "" }: Props) {
  const playbackSong = useMemo(
    () => ({
      title: song.title,
      artist: song.artist,
      audioCid: song.audioCid,
      audioUrl: song.audioUrl,
      isCurated: song.isCurated,
      livepeerPlaybackId: song.livepeerPlaybackId,
      embedSourceKind: song.embedSourceKind,
      youtubeUrl: song.youtubeUrl,
      embedIframeUrl: song.embedIframeUrl,
      creativeTvUrl: song.creativeTvUrl,
      listenUrl: song.listenUrl
    }),
    [song]
  );

  const controls = useSongPlayback({ song: playbackSong, embedOrigin });
  const isLinkOnly = controls.sourceKind === "link_only";

  const progressPct =
    controls.duration > 0 ? Math.min(100, (controls.progress / controls.duration) * 100) : 0;

  return (
    <section className="mt-album-deck song-player-shell" aria-label="Track player">
      {controls.sourceKind === "pinata" ? <CassettePlayer
        artist={song.artist}
        isPlaying={controls.isPlaying}
        canPlay={controls.playerReady}
        onToggle={controls.togglePlay}
        title={song.title}
      /> : null}
      <SongPlaybackMedia
        controls={controls}
        showVideo
        onLivepeerPlaying={controls.onLivepeerPlaying}
        onLivepeerTime={controls.onLivepeerTime}
      />
      <div className="song-player-controls">
        {isLinkOnly ? (
          controls.outboundUrl
            ? <button className="mt-primary" onClick={controls.openOutbound} type="button">Open listening link ↗</button>
            : null
        ) : isLinkOnly || ["pinata", "iframe"].includes(controls.sourceKind) ? null : (
          <button className="mt-primary" disabled={!controls.playerReady} onClick={controls.togglePlay} type="button">
            {!controls.playerReady ? "Loading…" : controls.isPlaying ? "Pause" : "Play"}
          </button>
        )}
        {controls.duration > 0 ? (
          <div className="song-player-progress">
            <div className="song-player-progress-bar" style={{ width: `${progressPct}%` }} />
            <span className="muted">
              {formatTime(controls.progress)} / {formatTime(controls.duration)}
            </span>
          </div>
        ) : null}
      </div>

      {isLinkOnly && !controls.outboundUrl ? (
        <p className="muted">
          Playback is unavailable for this track.
        </p>
      ) : null}

      {controls.error ? <p className="mt-error" role="alert">{controls.error}</p> : null}

      <div className="link-row">
        {song.creativeTvUrl ? (
          <a href={song.creativeTvUrl} rel="noreferrer" target="_blank">
            Creative TV
          </a>
        ) : null}
        {song.youtubeUrl ? (
          <a href={song.youtubeUrl} rel="noreferrer" target="_blank">
            YouTube
          </a>
        ) : null}
        {song.musicbrainzUrl ? (
          <a href={song.musicbrainzUrl} rel="noreferrer" target="_blank">
            MusicBrainz
          </a>
        ) : null}
        {song.listenUrl ? (
          <a href={song.listenUrl} rel="noreferrer" target="_blank">
            Listen
          </a>
        ) : null}
      </div>
    </section>
  );
}
