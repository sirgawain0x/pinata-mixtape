"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Mix } from "../mixtape-app";
import { useMixPlayback } from "../hooks/useMixPlayback";
import { resolvePlaybackSource } from "../../lib/song-playback";
import { isYoutubeSearchUrl } from "../../lib/recording-links";
import { isTrackHiddenFromPublicPlayback } from "../../lib/track-playback-policy";
import CassettePlayer from "./CassettePlayer";
import LivepeerSongBridge from "./LivepeerSongBridge";
import { PlaylistArt } from "./MixtapeIcons";

export default function PlaylistDetail({ mix, trackIndex, canEdit, onEdit }: {
  mix: Mix;
  trackIndex: number;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const playback = useMixPlayback({
    tracks: mix.tracks,
    mixId: mix.id,
    ytElementId: `mt-youtube-${mix.id}`,
    initialTrackIndex: trackIndex,
    fallbackToFirstPlayable: false
  });
  const [shareStatus, setShareStatus] = useState("");
  const playerRef = useRef<HTMLDivElement>(null);
  const active = playback.nowPlaying ?? mix.tracks[trackIndex] ?? mix.tracks[0];
  const outboundUrl = active ? resolvePlaybackSource(active).outboundUrl : undefined;
  const outboundLabel = isYoutubeSearchUrl(outboundUrl)
    ? "Search YouTube"
    : "Open listening link";
  const showVideo = playback.showYoutubeEmbed || Boolean(playback.livepeerPlaybackId);
  const showCassette = playback.currentSourceKind === "pinata" || showVideo;
  const playerLayout = showVideo ? "cassette-video" : showCassette ? "cassette" : "embed";

  function selectTrack(index: number) {
    const position = playback.playableQueue.findIndex((item) => item.trackIndex === index);
    if (position < 0) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playerRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    if (position === playback.queuePosition && playback.playerReady) {
      if (playback.currentSourceKind !== "iframe") playback.togglePlay();
      return;
    }
    playback.playTrack(index);
  }

  async function share() {
    try {
      const url = new URL(window.location.href);
      if (mix.slug && mix.isPublic) {
        url.pathname = `/app/m/${mix.slug}`;
        url.search = "";
      }
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Playlist link copied.");
    } catch { setShareStatus("Copy this page’s address to share your playlist."); }
  }

  return <section className="mt-album">
    <div className="mt-section-heading"><Link href="/">← All playlists</Link>
      <Link href={`/?mix=${mix.id}&view=studio`}>Open studio ↗</Link></div>
    <div className="mt-album-layout">
      <div className="mt-album-deck" ref={playerRef}>
        {playback.currentSourceKind ? (
          <div className="mt-player-transition" key={playerLayout}>
            {showCassette ? <CassettePlayer
              title={active?.title ?? mix.title} artist={active?.artist}
              isPlaying={playback.isPlaying} canPlay={playback.playerReady}
              onToggle={playback.togglePlay} trackIndex={playback.queuePosition} trackCount={playback.playableQueue.length}/> : null}
            {playback.showYoutubeEmbed ? <div className="mt-video"><div id={`mt-youtube-${mix.id}`}/></div> : null}
            {playback.iframeUrl ? <iframe className="mt-embed" ref={playback.iframeRef} src={playback.iframeUrl}
              title={`${active?.title ?? mix.title} player`} allow="autoplay; encrypted-media; fullscreen" /> : null}
            {playback.iframeUrl && outboundUrl ? <a href={outboundUrl} target="_blank" rel="noopener noreferrer">Open in listening service ↗</a> : null}
            {playback.livepeerPlaybackId ? <div className="mt-video"><LivepeerSongBridge
              playbackId={playback.livepeerPlaybackId} isPlaying={playback.isPlaying}
              onPlayingChange={playback.setIsPlaying} showControls/></div> : null}
          </div>
        ) : null}
        {!playback.currentSourceKind ? <div className="mt-empty mt-playback-fallback">
          <h3>{active?.title ?? "No tracks yet"}</h3>
          <p>{active ? active.artist : "Add a track to start listening."}</p>
          {outboundUrl ? <a href={outboundUrl} target="_blank" rel="noopener noreferrer">{outboundLabel} ↗</a> : null}
        </div> : null}
        {playback.error ? <div role="alert" className="mt-error"><p>{playback.error.message}</p>
          {outboundUrl ? <a href={outboundUrl} target="_blank" rel="noopener noreferrer">{outboundLabel} ↗</a> : null}
          {playback.queuePosition < playback.playableQueue.length - 1 ? <button type="button" onClick={playback.skip}>Skip unavailable track</button> : null}
        </div> : null}
      </div>
      <div className="mt-album-info">
        <div className="mt-album-art"><PlaylistArt id={mix.id} title={mix.title}/></div>
        <div className="mt-album-copy"><p className="mt-kicker">{mix.genre || mix.vibe || "PLAYLIST"}</p>
          <h1>{mix.title}</h1><p>{mix.creators?.join(" / ") || mix.djPersona}</p>
          <span>{mix.tracks.length} tracks{mix.duration ? ` · ${mix.duration}` : ""}</span>
          <p className="mt-album-description">{mix.description}</p>
          <div className="mt-actions">
            {canEdit ? <button type="button" onClick={onEdit}>Edit playlist</button> : null}
            <button type="button" onClick={() => void share()}>Share ↗</button>
            {mix.creatorId ? <Link href={`/?page=profile&creator=${mix.creatorId}`}>Creator profile</Link> : null}
            {mix.sourceUrl ? <a href={mix.sourceUrl} target="_blank" rel="noopener noreferrer">Source ↗</a> : null}
          </div>
          <p className="mt-note" role="status">{shareStatus}</p>
        </div>
      </div>
    </div>
    <div className="mt-section-heading"><h2>TRACKLIST</h2><span>{String(mix.tracks.length).padStart(2, "0")} tracks</span></div>
    <ol className="mt-tracklist">
      {mix.tracks.map((track, index) => {
        if (!canEdit && isTrackHiddenFromPublicPlayback(track)) return null;
        const source = resolvePlaybackSource(track);
        const playable = source.kind !== "link_only";
        const selected = playback.currentTrackIndex === index;
        const playing = selected && playback.isPlaying;
        return <li key={`${track.songId ?? index}-${index}`} className={selected ? "mt-track-row mt-track-current" : "mt-track-row"}
          aria-current={selected ? "true" : undefined} data-playing={playing || undefined}>
          <button className="mt-track-play" type="button" onClick={() => selectTrack(index)} disabled={!playable}
            aria-label={`${source.kind === "iframe" ? "Open player for" : playing ? "Pause" : "Play"} ${track.title}`}>
            <span>{playing ? "Ⅱ" : playable ? "▶" : String(index + 1).padStart(2, "0")}</span>
            <PlaylistArt compact id={track.songId ?? index} title={track.title}/>
            <span className="mt-track-name"><strong>{track.title}</strong><small>{track.artist}</small></span>
          </button>
          <span className="mt-track-year">{track.releaseYear}</span><span>{track.duration || "—"}</span>
          {track.songId ? <Link className="mt-track-link" href={`/songs/${track.songId}?fromMix=${mix.id}&track=${index}`} aria-label={`Details for ${track.title}`}>↗</Link> : null}
          {!playable && source.outboundUrl ? <a href={source.outboundUrl} target="_blank" rel="noopener noreferrer">{isYoutubeSearchUrl(source.outboundUrl) ? "Find ↗" : "Listen ↗"}</a> : null}
        </li>;
      })}
    </ol>
    {mix.tracks.length === 0 ? <div className="mt-empty"><h3>The first track is yours.</h3><p>Add a song to start shaping this playlist.</p>{canEdit ? <button onClick={onEdit} type="button">Add tracks</button> : null}</div> : null}
  </section>;
}
