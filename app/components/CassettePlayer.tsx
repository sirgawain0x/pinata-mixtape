"use client";

type CassettePlayerProps = {
  isPlaying: boolean;
  canPlay: boolean;
  onToggle: () => void;
  title: string;
  artist?: string;
  trackIndex?: number;
  trackCount?: number;
  size?: "medium" | "mini";
};

export default function CassettePlayer({
  isPlaying,
  canPlay,
  onToggle,
  title,
  artist,
  trackIndex,
  trackCount,
  size = "medium"
}: CassettePlayerProps) {
  const label = canPlay ? (isPlaying ? "Pause" : "Play") : "No playable links";
  const isMini = size === "mini";
  const sizeClass = isMini ? "cassette cassette-mini" : "cassette cassette-player";

  const cassetteBody = (
    <div className={isPlaying ? `${sizeClass} cassette-playing` : sizeClass} aria-hidden="true">
      <span className="cassette-screw cassette-screw-tl" />
      <span className="cassette-screw cassette-screw-tr" />
      <span className="cassette-screw cassette-screw-bl" />
      <span className="cassette-screw cassette-screw-br" />
      <div className="cassette-top-strip" />
      <div className="cassette-label-block">
        <span className="cassette-label-band cassette-label-band-a" />
        <span className="cassette-label-band cassette-label-band-b" />
        <span className="cassette-label-band cassette-label-band-c" />
      </div>
      <div className="cassette-window">
        <span className="cassette-reel cassette-reel-left" />
        <span className="cassette-tape" />
        <span className="cassette-reel cassette-reel-right" />
        <span className="cassette-window-bar" />
      </div>
      <div className="cassette-bottom">
        <span className="cassette-hole cassette-hole-left" />
        <span className="cassette-bottom-center" />
        <span className="cassette-hole cassette-hole-right" />
      </div>
    </div>
  );

  return (
    <div className={isMini ? "cassette-player-wrap cassette-player-wrap-mini" : "cassette-player-wrap"}>
      {isMini ? cassetteBody : <div className="cassette-player-scale">{cassetteBody}</div>}

      <div className="cassette-now-playing">
        <span className="cassette-now-playing-title">{title}</span>
        {artist ? <span className="cassette-now-playing-artist">{artist}</span> : null}
      </div>

      <div className="cassette-controls">
        <button className="tt-play" disabled={!canPlay} onClick={onToggle} type="button">
          <span
            aria-hidden="true"
            className={isPlaying ? "tt-play-icon tt-play-icon-pause" : "tt-play-icon tt-play-icon-play"}
          />
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
