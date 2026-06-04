"use client";

import { useMemo, useState } from "react";
import RecordPlayerCanvas from "./record-player/RecordPlayerCanvas";
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
  const [, setLivepeerTick] = useState(0);

  const progressPct =
    controls.duration > 0 ? Math.min(100, (controls.progress / controls.duration) * 100) : 0;

  return (
    <section className="song-player-shell">
      <RecordPlayerCanvas isPlaying={controls.isPlaying} onTogglePlay={controls.togglePlay} />
      <SongPlaybackMedia
        controls={controls}
        onLivepeerPlaying={() => setLivepeerTick((n) => n + 1)}
        onLivepeerTime={() => setLivepeerTick((n) => n + 1)}
      />

      <div className="song-player-controls">
        <button className="button" onClick={controls.togglePlay} type="button">
          {controls.isPlaying ? "Pause" : "Play"}
        </button>
        {controls.duration > 0 ? (
          <div className="song-player-progress">
            <div className="song-player-progress-bar" style={{ width: `${progressPct}%` }} />
            <span className="muted">
              {formatTime(controls.progress)} / {formatTime(controls.duration)}
            </span>
          </div>
        ) : (
          <span className="muted">Source: {controls.sourceKind.replace("_", " ")}</span>
        )}
      </div>

      {controls.error ? <p className="signin-error">{controls.error}</p> : null}

      {controls.sourceKind === "link_only" && controls.outboundUrl ? (
        <p>
          <a className="button secondary-button" href={controls.outboundUrl} rel="noreferrer" target="_blank">
            Open listen link →
          </a>
        </p>
      ) : null}

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
