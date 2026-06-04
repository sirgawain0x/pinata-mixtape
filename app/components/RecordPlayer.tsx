"use client";

type RecordPlayerProps = {
  isPlaying: boolean;
  canPlay: boolean;
  onToggle: () => void;
  title: string;
  artist?: string;
  trackIndex?: number;
  trackCount?: number;
};

/**
 * CSS turntable player. The vinyl spins and the tonearm drops onto the record
 * while audio is playing, and the arm lifts back off when stopped. Visual /
 * interaction model adapted from Ryan Mulligan's "CSS Record Player"
 * (https://codepen.io/hexagoncircle/pen/WwOzwq).
 */
export default function RecordPlayer({
  isPlaying,
  canPlay,
  onToggle,
  title,
  artist,
  trackIndex,
  trackCount
}: RecordPlayerProps) {
  const stateClass = isPlaying ? "is-playing" : "is-stopped";
  const label = canPlay ? (isPlaying ? "Pause" : "Play") : "No playable links";

  return (
    <div className={`turntable ${stateClass}`}>
      <div className="tt-deck">
        <div className="tt-platter">
          <button
            className="tt-record"
            type="button"
            onClick={onToggle}
            disabled={!canPlay}
            aria-pressed={isPlaying}
            aria-label={canPlay ? `${isPlaying ? "Pause" : "Play"} ${title}` : "No playable links for this mix"}
          >
            <span className="tt-grooves" aria-hidden="true" />
            <span className="tt-label">
              <span className="tt-label-title">{title}</span>
              {artist ? <span className="tt-label-artist">{artist}</span> : null}
            </span>
            <span className="tt-spindle" aria-hidden="true" />
          </button>
        </div>

        <div className="tt-tonearm" aria-hidden="true">
          <span className="tt-tonearm-base" />
          <span className="tt-tonearm-rod" />
          <span className="tt-tonearm-head" />
        </div>
      </div>

      <div className="tt-controls">
        <button className="tt-play" type="button" onClick={onToggle} disabled={!canPlay}>
          <span className={isPlaying ? "tt-play-icon tt-play-icon-pause" : "tt-play-icon tt-play-icon-play"} aria-hidden="true" />
          {label}
        </button>
        {canPlay && typeof trackIndex === "number" && typeof trackCount === "number" && trackCount > 0 ? (
          <span className="tt-track-counter">
            {String(Math.min(trackIndex + 1, trackCount)).padStart(2, "0")} / {String(trackCount).padStart(2, "0")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
