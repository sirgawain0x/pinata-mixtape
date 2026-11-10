"use client";

import { useMemo } from "react";
import { resolvePlaybackSource, type SongPlaybackFields } from "../../lib/song-playback";
import { SongPlaybackMedia, useSongPlayback } from "../hooks/useSongPlayback";

type Props = {
  track: SongPlaybackFields;
  label?: string;
  compact?: boolean;
};

export default function TrackPreview({ track, label = "Preview", compact = false }: Props) {
  const source = useMemo(() => resolvePlaybackSource(track), [track]);
  const controls = useSongPlayback({ song: track });

  if (source.kind === "link_only") {
    return (
      <div className={compact ? "track-preview track-preview-compact" : "track-preview"}>
        <p className="muted track-preview-warning">
          {source.outboundUrl
            ? "Open the listening link to find this recording."
            : "Add a title and artist to find this recording."}
        </p>
        {source.outboundUrl ? (
          <a className="button secondary-button" href={source.outboundUrl} rel="noreferrer" target="_blank">
            Open listen link →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className={compact ? "track-preview track-preview-compact" : "track-preview"}>
      {source.kind !== "iframe" ? <div className="track-preview-controls">
        <button
          className="secondary-button"
          disabled={!controls.playerReady}
          onClick={controls.togglePlay}
          type="button"
        >
          {!controls.playerReady ? "Loading…" : controls.isPlaying ? "Pause preview" : `${label}`}
        </button>
        <span className="muted">Source: {controls.sourceKind.replace("_", " ")}</span>
      </div> : null}
      {controls.error ? <p className="signin-error">{controls.error}</p> : null}
      <SongPlaybackMedia
        controls={controls}
        showVideo={source.kind === "iframe"}
        onLivepeerPlaying={controls.onLivepeerPlaying}
        onLivepeerTime={controls.onLivepeerTime}
      />
    </div>
  );
}
