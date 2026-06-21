"use client";

import { useMemo } from "react";
import Link from "next/link";
import RecordPlayerCanvas from "./record-player/RecordPlayerCanvas";
import { SongPlaybackMedia, useSongPlayback } from "../hooks/useSongPlayback";
import { buildCrateUrl } from "../../lib/mixtape-nav";
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
  backMix?: { id: number; title: string; trackIndex?: number | null };
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SongPlayerShell({ song, embedOrigin = "", backMix }: Props) {
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
  const isLinkOnly = controls.sourceKind === "link_only";

  const progressPct =
    controls.duration > 0 ? Math.min(100, (controls.progress / controls.duration) * 100) : 0;

  return (
    <section className="song-player-shell">
      {backMix ? (
        <p className="song-back-link">
          <Link href={buildCrateUrl({ mixId: backMix.id, trackIndex: backMix.trackIndex })}>
            ← Back to {backMix.title}
          </Link>
        </p>
      ) : (
        <p className="song-back-link">
          <Link href="/">← Back to crate</Link>
        </p>
      )}

      <RecordPlayerCanvas
        artist={song.artist}
        isPlaying={controls.isPlaying}
        onTogglePlay={controls.togglePlay}
        title={song.title}
      />
      <SongPlaybackMedia
        controls={controls}
        onLivepeerPlaying={controls.onLivepeerPlaying}
        onLivepeerTime={controls.onLivepeerTime}
      />

      <div className="song-player-controls">
        {isLinkOnly ? (
          <button className="button" disabled={!controls.outboundUrl} onClick={controls.openOutbound} type="button">
            Open listen link →
          </button>
        ) : (
          <button className="button" disabled={!controls.playerReady} onClick={controls.togglePlay} type="button">
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
        ) : (
          <span className="muted">
            Source: {controls.sourceKind.replace("_", " ")}
            {controls.outboundUrl ? (
              <>
                {" "}
                ·{" "}
                <a href={controls.outboundUrl} rel="noreferrer" target="_blank">
                  {controls.outboundUrl.replace(/^https?:\/\//, "").slice(0, 48)}
                </a>
              </>
            ) : null}
          </span>
        )}
      </div>

      {isLinkOnly ? (
        <p className="muted song-link-only-note">
          Add a direct YouTube URL on the mixtape to play this track in-app.
        </p>
      ) : null}

      {controls.error ? <p className="signin-error">{controls.error}</p> : null}

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
