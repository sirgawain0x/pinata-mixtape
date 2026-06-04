"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { youtubeEmbedUrl, youtubeVideoId } from "../lib/youtube";
import MixtapeEditor from "./components/MixtapeEditor";
import SignInButton from "./components/SignInButton";

export type HostedMixResult = {
  mixId: number;
  mixTitle: string;
  voice: string;
  output: string;
  durationSeconds?: number;
  script: string;
  streamUrl: string;
  downloadUrl: string;
  clips: Record<string, string>;
  segments: Record<string, string>;
  sourceTracks?: Array<Record<string, unknown>>;
};

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: unknown) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayer = {
  destroy: () => void;
  getPlaylistIndex: () => number;
  getPlayerState: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  getVideoData: () => { video_id?: string };
};

const NARRATION_VOICES = [
  { id: "am_adam", label: "Adam" },
  { id: "am_michael", label: "Michael" },
  { id: "am_echo", label: "Echo" },
  { id: "af_sky", label: "Sky" },
  { id: "af_nova", label: "Nova" }
] as const;

export type Track = {
  songId?: number;
  title: string;
  artist: string;
  releaseYear: string;
  duration: string;
  bpm: string;
  energy: string;
  moodTags: string[];
  sceneTags: string[];
  notes: string;
  musicbrainzId: string;
  musicbrainzUrl: string;
  youtubeUrl: string;
  listenUrl: string;
  creativeTvUrl: string;
  embedSourceKind: "youtube" | "creativetv" | "iframe_allowed" | "link_only";
  embedIframeUrl: string;
};

export type Mix = {
  id: number;
  title: string;
  description: string;
  vibe: string;
  useCase: string;
  duration: string;
  djPersona: string;
  coverTheme: string;
  shareNote: string;
  tags: string[];
  tracks: Track[];
  creatorId: number | null;
  isPublic: boolean;
  slug: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MixMoment = {
  id: number;
  title: string;
  body: string;
  kind: "memory" | "set" | "discovery" | "note";
  mixId: number | null;
  mixTitle: string;
  createdAt: string;
};

export type Song = Track & {
  id: number;
  mixCount: number;
  mixIds: number[];
};

export type Station = {
  id: number;
  handle: string;
  name: string;
  tagline: string;
};

type MixtapeAppProps = {
  initialMixes: Mix[];
  initialMoments: MixMoment[];
  initialSongs: Song[];
  initialStations: Station[];
  initialSelectedId: number | null;
};

export default function MixtapeApp({
  initialMixes,
  initialMoments,
  initialSongs,
  initialStations,
  initialSelectedId
}: MixtapeAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mixes, setMixes] = useState<Mix[]>(initialMixes);
  const [moments, setMoments] = useState<MixMoment[]>(initialMoments);
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialMixes.some((mix) => mix.id === initialSelectedId) ? initialSelectedId : initialMixes[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(
    `${initialMixes.length} tape${initialMixes.length === 1 ? "" : "s"} in rotation`
  );
  const [shareStatus, setShareStatus] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMix, setEditorMix] = useState<Mix | null>(null);
  const [hostedMixes, setHostedMixes] = useState<Record<number, HostedMixResult | null>>({});
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [generatingNarrationFor, setGeneratingNarrationFor] = useState<number | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [pendingVoice, setPendingVoice] = useState("am_adam");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>({});
  const [latestBroadcastMoment, setLatestBroadcastMoment] = useState<MixMoment | null>(initialMoments[0] ?? null);
  const [broadcastMomentPulse, setBroadcastMomentPulse] = useState(false);
  const [playlistIsPlaying, setPlaylistIsPlaying] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedRef = useRef<Record<string, boolean>>({});
  const currentMixRef = useRef<number | null>(null);

  const selected = useMemo(
    () => mixes.find((mix) => mix.id === selectedId) ?? mixes[0] ?? null,
    [mixes, selectedId]
  );

  const viewMode = searchParams.get("view") === "broadcast" ? "broadcast" : "explorer";

  async function loadMixes(query = search) {
    const response = await fetch(`/app/api/search?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as { mixes: Mix[]; songs: Song[] };
    setMixes(data.mixes);
    setSongs(data.songs);
    setSelectedId((current) => {
      if (data.mixes.some((mix) => mix.id === current)) return current;
      return data.mixes[0]?.id ?? null;
    });
    setStatus(
      `${data.mixes.length} tape${data.mixes.length === 1 ? "" : "s"} / ${data.songs.length} song${
        data.songs.length === 1 ? "" : "s"
      }`
    );
  }

  async function loadTimeline() {
    const response = await fetch("/app/api/timeline?limit=12");
    const data = (await response.json()) as { moments: MixMoment[] };
    setMoments(data.moments);
    setLatestBroadcastMoment(data.moments[0] ?? null);
  }

  function triggerBroadcastMomentPulse() {
    setBroadcastMomentPulse(true);
    window.setTimeout(() => setBroadcastMomentPulse(false), 900);
  }

  useEffect(() => {
    const editor = searchParams.get("editor");
    if (editor === "new") {
      setEditorMix(null);
      setEditorOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (initialMixes.length === 0) {
      void loadMixes("");
    }
    if (initialMoments.length === 0) {
      void loadTimeline();
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("mix", String(selectedId));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedId]);

  useEffect(() => {
    if (!selected || hostedMixes[selected.id] !== undefined) return;
    if (viewMode !== "broadcast" && !voiceModalOpen && generatingNarrationFor !== selected.id) return;

    let cancelled = false;

    async function loadHostedMix() {
      const response = await fetch(`/app/api/mixes/${selected.id}/dj-hosted`);
      if (!response.ok) return;
      const data = (await response.json()) as { result?: HostedMixResult | null };
      if (!cancelled) {
        setHostedMixes((current) => ({
          ...current,
          [selected.id]: (data.result ?? null) as HostedMixResult | null
        }));
      }
    }

    void loadHostedMix();

    return () => {
      cancelled = true;
    };
  }, [generatingNarrationFor, hostedMixes, selected, viewMode, voiceModalOpen]);

  useEffect(() => {
    if (currentMixRef.current !== selected?.id) {
      playedRef.current = {};
      currentMixRef.current = selected?.id ?? null;
      setCurrentTrackIndex(0);
      setExpandedTracks({});
      setPlaylistIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  }, [selected]);

  async function searchMixes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadMixes(search);
  }

  async function explore(term: string) {
    setSearch(term);
    await loadMixes(term);
  }

  async function openSong(song: Song) {
    setSearch(song.artist);
    const mixId = song.mixIds.find((id) => mixes.some((mix) => mix.id === id)) ?? song.mixIds[0] ?? null;
    if (mixId) {
      setSelectedId(mixId);
      return;
    }
    await loadMixes(song.artist);
  }

  function randomMix() {
    if (mixes.length === 0) return;
    const next = mixes[Math.floor(Math.random() * mixes.length)];
    setSelectedId(next.id);
  }

  function toggleTrack(trackKey: string) {
    setExpandedTracks((current) => ({ ...current, [trackKey]: !current[trackKey] }));
  }

  function handleMixSaved(mix: Mix) {
    setMixes((current) => {
      const exists = current.some((entry) => entry.id === mix.id);
      if (exists) return current.map((entry) => (entry.id === mix.id ? mix : entry));
      return [mix, ...current];
    });
    setSelectedId(mix.id);
    setStatus(`Saved ${mix.title}`);
  }

  async function copyShareLink() {
    if (!selected || typeof window === "undefined") return;
    const url = new URL(window.location.origin);
    url.pathname = selected.slug ? "/app/m/" + selected.slug : "/app/";
    if (!selected.slug) {
      url.searchParams.set("mix", String(selected.id));
    }

    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Link copied");
      window.setTimeout(() => setShareStatus(""), 1800);
    } catch {
      setShareStatus("Copy failed");
      window.setTimeout(() => setShareStatus(""), 1800);
    }
  }

  function switchView(nextView: "explorer" | "broadcast") {
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "broadcast") {
      params.set("view", "broadcast");
    } else {
      params.delete("view");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const facets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const mix of mixes) {
      [mix.vibe, mix.useCase, mix.djPersona, ...mix.tags].filter(Boolean).forEach((facet) => {
        counts.set(facet, (counts.get(facet) ?? 0) + 1);
      });
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10);
  }, [mixes]);

  const hosted = selected ? hostedMixes[selected.id] : null;

  function openVoiceModal() {
    setPendingVoice(hosted?.voice || "am_adam");
    setVoiceModalOpen(true);
  }

  async function generateNarration(voice = pendingVoice) {
    if (!selected) return;
    setGeneratingNarrationFor(selected.id);
    setShareStatus("Generating narration clips...");
    try {
      const response = await fetch(`/app/api/mixes/${selected.id}/dj-hosted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice })
      });
      const data = (await response.json()) as { result?: HostedMixResult; error?: string };
      if (!response.ok || !data.result) {
        throw new Error(data.error || "Could not generate narration.");
      }
      setHostedMixes((current) => ({ ...current, [selected.id]: data.result as HostedMixResult }));
      playedRef.current = {};
      setVoiceModalOpen(false);
      setPendingVoice(data.result.voice);
      setShareStatus(`Narration ready in ${data.result.voice}`);
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "Narration generation failed");
      console.error(error);
    } finally {
      setGeneratingNarrationFor(null);
      window.setTimeout(() => setShareStatus(""), 3200);
    }
  }

  async function playNarrationClip(kind: string) {
    if (!hosted || !narrationEnabled || !playerRef.current) return;
    if (playedRef.current[kind]) return;

    const clipUrl = hosted.clips[kind];
    if (!clipUrl) return;

    playedRef.current[kind] = true;
    const previousVolume = playerRef.current.getVolume();
    playerRef.current.setVolume(10);

    const audio = new Audio(clipUrl);
    audio.volume = 1;
    audioRef.current = audio;
    audio.addEventListener(
      "ended",
      () => {
        playerRef.current?.setVolume(previousVolume);
        if (audioRef.current === audio) audioRef.current = null;
      },
      { once: true }
    );
    audio.addEventListener(
      "error",
      () => {
        playerRef.current?.setVolume(previousVolume);
        if (audioRef.current === audio) audioRef.current = null;
      },
      { once: true }
    );
    await audio.play().catch(() => {
      playerRef.current?.setVolume(previousVolume);
      if (audioRef.current === audio) audioRef.current = null;
    });
  }

  const totalTracks = useMemo(
    () => new Set(mixes.flatMap((mix) => mix.tracks.map((track) => `${track.artist}::${track.title}`))).size,
    [mixes]
  );

  const mixYoutubeTracks = useMemo(() => {
    if (!selected) return [] as Array<{ videoId: string; title: string; artist: string; index: number }>;
    return selected.tracks
      .map((track, index) => ({
        videoId: youtubeVideoId(track.youtubeUrl),
        title: track.title,
        artist: track.artist,
        index
      }))
      .filter((track) => track.videoId);
  }, [selected]);

  const mixYoutubeIds = useMemo(() => mixYoutubeTracks.map((track) => track.videoId), [mixYoutubeTracks]);
  const broadcastTrack = selected?.tracks[currentTrackIndex] ?? selected?.tracks[0] ?? null;
  const broadcastQueue = selected?.tracks.slice(currentTrackIndex + 1, currentTrackIndex + 4) ?? [];
  const shareUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("mix", String(selected?.id ?? ""));
      url.searchParams.set("view", "broadcast");
      return url.toString();
    }

    if (!selected) return "";
    return `https://xjmsnx0f.agents.pinata.cloud/app?mix=${selected.id}&view=broadcast`;
  }, [selected]);
  const qrUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(shareUrl)}`
    : "";

  useEffect(() => {
    if (viewMode !== "broadcast") return;

    let cancelled = false;

    async function pollLatestMoment() {
      try {
        const response = await fetch("/app/api/timeline?limit=1");
        if (!response.ok) return;
        const data = (await response.json()) as { moments: MixMoment[] };
        if (!cancelled) {
          const nextMoment = data.moments[0] ?? null;
          setLatestBroadcastMoment((current) => {
            const changed = (current?.id ?? null) !== (nextMoment?.id ?? null);
            if (changed && nextMoment) {
              triggerBroadcastMomentPulse();
            }
            return nextMoment;
          });
        }
      } catch {
        // ignore transient polling errors in broadcast mode
      }
    }

    void pollLatestMoment();
    const interval = window.setInterval(() => {
      void pollLatestMoment();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [viewMode]);

  useEffect(() => {
    if (!selected || mixYoutubeIds.length === 0) return;

    const elementId = viewMode === "broadcast" ? `yt-player-broadcast-${selected.id}` : `yt-player-${selected.id}`;
    const setupPlayer = () => {
      if (!window.YT?.Player) return;
      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(elementId, {
        videoId: mixYoutubeIds[0],
        playerVars: {
          playlist: mixYoutubeIds.slice(1).join(","),
          rel: 0,
          modestbranding: 1
        },
        events: {
          onStateChange: (event: { data: number }) => {
            if (!window.YT || !playerRef.current) return;

            const currentVideoId = playerRef.current.getVideoData?.().video_id ?? "";
            const resolvedIndex = mixYoutubeTracks.findIndex((track) => track.videoId === currentVideoId);
            const index = resolvedIndex >= 0 ? resolvedIndex : playerRef.current.getPlaylistIndex?.() ?? 0;
            const lastIndex = mixYoutubeTracks.length - 1;
            setCurrentTrackIndex(Math.max(0, index));

            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlaylistIsPlaying(true);
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED ||
              event.data === window.YT.PlayerState.BUFFERING ||
              event.data === window.YT.PlayerState.CUED ||
              event.data === window.YT.PlayerState.UNSTARTED
            ) {
              setPlaylistIsPlaying(false);
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              if (index === lastIndex) {
                void playNarrationClip("outro");
              }
              return;
            }

            if (event.data !== window.YT.PlayerState.PLAYING) return;

            if (index === 0) {
              void playNarrationClip("intro");
            } else if (index > 0) {
              void playNarrationClip(`transition_${index}`);
            }
          }
        }
      });
    };

    if (window.YT?.Player) {
      setupPlayer();
    } else {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = setupPlayer;
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [mixYoutubeIds, narrationEnabled, selected?.id, hosted?.clips.intro, mixYoutubeTracks, viewMode]);

  if (viewMode === "broadcast") {
    return (
      <main className="broadcast-shell">
        {selected ? (
          <section className="broadcast-deck">
            <div className="broadcast-stage">
              <div className="broadcast-stage-backdrop" aria-hidden="true" />
              <div className="broadcast-stage-overlay" />
              <div className="broadcast-player-frame">
                {mixYoutubeIds.length > 0 ? (
                  <div className="mix-player-embed broadcast-embed">
                    <div className="yt-player-shell" id={`yt-player-broadcast-${selected.id}`} />
                  </div>
                ) : (
                  <div className="broadcast-fallback-art">
                    <span className="eyebrow">No direct video links</span>
                    <h2>{selected.title}</h2>
                    <p>{selected.description}</p>
                  </div>
                )}
              </div>

              <div className="broadcast-now-playing">
                <span className="eyebrow">Now playing</span>
                <h1>{broadcastTrack?.title ?? selected.title}</h1>
                <p>{broadcastTrack ? broadcastTrack.artist : selected.djPersona}</p>
                <div className="broadcast-meta-row">
                  {broadcastTrack?.duration ? <span>{broadcastTrack.duration}</span> : null}
                  {selected.duration ? <span>Mix {selected.duration}</span> : null}
                  <span>{selected.tracks.length} tracks</span>
                </div>
              </div>
            </div>

            <aside className="broadcast-rail">
              <div className="broadcast-rail-block">
                <p className="eyebrow">Mix title</p>
                <h2>{selected.title}</h2>
                <p className="broadcast-description">{selected.description}</p>
              </div>

              <div className="broadcast-rail-block broadcast-qr-block">
                <p className="eyebrow">Open this mix</p>
                {qrUrl ? <img alt={`QR for ${selected.title}`} className="broadcast-qr" src={qrUrl} /> : null}
                <small>{shareUrl.replace(/^https?:\/\//, "")}</small>
              </div>

              <div className="broadcast-rail-block">
                <p className="eyebrow">Deck accent</p>
                <div className={playlistIsPlaying ? "cassette cassette-mini cassette-playing" : "cassette cassette-mini"} aria-hidden="true">
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
              </div>

              <div className="broadcast-rail-block">
                <p className="eyebrow">Up next</p>
                <div className="broadcast-queue">
                  {broadcastQueue.length > 0 ? (
                    broadcastQueue.map((track, index) => (
                      <article className="broadcast-queue-item" key={`${track.artist}-${track.title}`}>
                        <span>{String(currentTrackIndex + index + 2).padStart(2, "0")}</span>
                        <div>
                          <strong>{track.title}</strong>
                          <small>{track.artist}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="muted">No more queued tracks yet.</p>
                  )}
                </div>
              </div>

              <div className={broadcastMomentPulse ? "broadcast-rail-block broadcast-module-slot broadcast-module-slot-pulse" : "broadcast-rail-block broadcast-module-slot"}>
                <p className="eyebrow">Live note</p>
                {latestBroadcastMoment ? (
                  <div>
                    <strong>{latestBroadcastMoment.title}</strong>
                    <p>{latestBroadcastMoment.body}</p>
                    <small>
                      {latestBroadcastMoment.kind}
                      {latestBroadcastMoment.createdAt
                        ? ` · ${new Date(`${latestBroadcastMoment.createdAt}Z`).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit"
                          })}`
                        : ""}
                    </small>
                  </div>
                ) : (
                  <div>
                    <strong>No live notes yet</strong>
                    <p>Add a timeline note in chat and it will show up here on the broadcast deck.</p>
                  </div>
                )}
              </div>
            </aside>
          </section>
        ) : (
          <div className="empty">Save a tape in chat to start building your listening memory.</div>
        )}
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark">
            <span>Pinata agent template</span>
            <span className="raid-stamp" aria-label="by RaidGuild">by RaidGuild</span>
          </p>
          <h1>Pinata Mixtape</h1>
          <p className="lede">
            Build retro mixtapes, track your taste, and shape an event arc with a DJ persona,
            timeline moments, and share-friendly outbound links.
          </p>
          <div className="hero-badges">
            <span>taste capture</span>
            <span>party arc</span>
            <span>MusicBrainz-ready</span>
          </div>
          <div className="hero-actions">
            <SignInButton />
            <button
              className="button"
              onClick={() => {
                setEditorMix(null);
                setEditorOpen(true);
              }}
              type="button"
            >
              New tape
            </button>
            <Link className="button" href="/dashboard">Host a station →</Link>
          </div>
        </div>

        <div className="deck-card">
          <p className="eyebrow">Influencer Radio</p>
          <h2>Live stations</h2>
          {initialStations.length === 0 ? (
            <p className="muted">No public stations yet. Sign in to host the first.</p>
          ) : (
            <ul className="station-grid">
              {initialStations.slice(0, 6).map((station) => (
                <li className="station-card" key={station.id}>
                  <h3>{station.name}</h3>
                  <p>@{station.handle}</p>
                  {station.tagline ? <p className="muted">{station.tagline}</p> : null}
                  <Link className="button" href={`/s/${station.handle}`}>Listen</Link>
                </li>
              ))}
            </ul>
          )}
          <div className="deck-status">
            <span>{status}</span>
            <span>Outbound links only. No audio proxying.</span>
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <form className="search" onSubmit={searchMixes}>
            <input
              aria-label="Search tapes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vibe, artist, scene, persona"
            />
            <button type="submit">Scan</button>
          </form>

          <div className="sidebar-section">
            <p className="eyebrow">Mixes</p>
            <div className="mix-list">
              {mixes.map((mix) => (
                <button
                  className={mix.id === selected?.id ? "mix-card active" : "mix-card"}
                  key={mix.id}
                  onClick={() => setSelectedId(mix.id)}
                  type="button"
                >
                  <span>{mix.title}</span>
                  <small>{[mix.vibe, mix.useCase].filter(Boolean).join(" / ") || "saved tape"}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <p className="eyebrow">Songs</p>
            <div className="song-list">
              {songs.length > 0 ? (
                songs.map((song) => (
                  <button className="song-card" key={song.id} onClick={() => void openSong(song)} type="button">
                    <span>{song.title}</span>
                    <small>{song.artist}</small>
                    <small>{[song.energy, `${song.mixCount} mix${song.mixCount === 1 ? "" : "es"}`].filter(Boolean).join(" / ")}</small>
                  </button>
                ))
              ) : (
                <span className="muted">No song hits yet.</span>
              )}
            </div>
          </div>
        </aside>

        <section className="detail">
          {selected ? (
            <>
              <div className="timeline-band">
                <div className="timeline-head">
                  <div>
                    <p className="eyebrow">Mix log</p>
                    <h3>Listening Timeline</h3>
                  </div>
                  <span>{moments.length} recent</span>
                </div>
                <div className="timeline">
                  {moments.length > 0 ? (
                    moments.map((moment) => (
                      <article className="moment" key={moment.id}>
                        <time dateTime={moment.createdAt}>
                          {new Date(`${moment.createdAt}Z`).toLocaleDateString([], {
                            month: "short",
                            day: "numeric"
                          })}
                        </time>
                        <div>
                          <span>{moment.kind}</span>
                          <h4>{moment.title}</h4>
                          <p>{moment.body}</p>
                          {moment.mixTitle ? <small>{moment.mixTitle}</small> : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>No moments yet. Save a mix or a taste memory through Pinata chat.</p>
                  )}
                </div>
              </div>

              <div className="tape-header">
                <div>
                  <p className="eyebrow">{selected.tags.join(" / ") || "mixtape"}</p>
                  <h2>{selected.title}</h2>
                  <p>{selected.description}</p>
                </div>
                <div className="tape-meta">
                  <span>{selected.duration}</span>
                  <span>{selected.djPersona}</span>
                  <button
                    onClick={() => {
                      setEditorMix(selected);
                      setEditorOpen(true);
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button onClick={() => void copyShareLink()} type="button">
                    Share
                  </button>
                  {selected.slug ? (
                    <Link className="button secondary-button" href={`/m/${selected.slug}`}>
                      Public page
                    </Link>
                  ) : null}
                </div>
              </div>
              {shareStatus ? <p className="share-status">{shareStatus}</p> : null}

              {editorOpen ? (
                <MixtapeEditor
                  mix={editorMix}
                  onClose={() => setEditorOpen(false)}
                  onSaved={handleMixSaved}
                />
              ) : null}

              {voiceModalOpen ? (
                <div className="modal-backdrop" role="presentation">
                  <div aria-modal="true" className="confirm-modal" role="dialog">
                    <p className="eyebrow">Narration voice</p>
                    <h3>{hosted ? "Regenerate narration clips?" : "Generate narration clips?"}</h3>
                    <p>
                      Pick a Kokoro voice for this mix before we {hosted ? "replace" : "create"} the DJ overlay clips.
                    </p>
                    <label className="modal-field">
                      <span>Voice</span>
                      <select value={pendingVoice} onChange={(event) => setPendingVoice(event.target.value)}>
                        {NARRATION_VOICES.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.label} ({voice.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="modal-actions">
                      <button className="secondary-button" onClick={() => setVoiceModalOpen(false)} type="button">
                        Cancel
                      </button>
                      <button onClick={() => void generateNarration(pendingVoice)} type="button">
                        {hosted ? "Confirm regenerate" : "Generate clips"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}


              <div className={playlistIsPlaying ? "cassette cassette-playing" : "cassette"} aria-hidden="true">
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

              {mixYoutubeIds.length > 0 ? (
                <div className="mix-player">
                  <div className="mix-player-head">
                    <div>
                      <p className="eyebrow">Mix Playback</p>
                      <h3>YouTube Queue</h3>
                    </div>
                    <span>
                      {mixYoutubeIds.length} direct link{mixYoutubeIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="player-toolbar">
                    <div className="player-toolbar-left">
                      <label className="narration-toggle">
                        <input
                          checked={narrationEnabled}
                          disabled={!hosted}
                          onChange={(event) => {
                            setNarrationEnabled(event.target.checked);
                            if (event.target.checked) {
                              playedRef.current = {};
                            }
                          }}
                          type="checkbox"
                        />
                        <span>Narration overlay</span>
                      </label>
                      <button
                        className="secondary-button"
                        disabled={generatingNarrationFor === selected.id}
                        onClick={openVoiceModal}
                        type="button"
                      >
                        {generatingNarrationFor === selected.id
                          ? "Generating..."
                          : hosted
                            ? "Regenerate clips"
                            : "Generate clips"}
                      </button>
                      <button className="secondary-button" onClick={() => switchView("broadcast")} type="button">
                        Open Broadcast Deck
                      </button>
                    </div>
                    {hosted ? <small>Voice: {hosted.voice}</small> : <small>No generated narration yet for this mix.</small>}
                  </div>
                  <div className="mix-player-embed">
                    <div className="yt-player-shell" id={`yt-player-${selected.id}`} />
                  </div>
                </div>
              ) : null}

              <div className="columns">
                <div>
                  <h3>Track List</h3>
                  <div className="track-grid">
                    {selected.tracks.map((track, index) => {
                      const trackKey = `${track.artist}-${track.title}-${index}`;
                      const isExpanded = !!expandedTracks[trackKey];
                      const trackMeta = [track.releaseYear, track.duration, track.energy].filter(Boolean);
                      const tags = track.moodTags.concat(track.sceneTags).filter(Boolean);

                      return (
                        <article className={isExpanded ? "track track-expanded" : "track"} key={trackKey}>
                          <button
                            aria-expanded={isExpanded}
                            className="track-toggle"
                            onClick={() => toggleTrack(trackKey)}
                            type="button"
                          >
                            <div className="track-head">
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <h4>{track.title}</h4>
                                <p>{track.artist}</p>
                              </div>
                            </div>
                            <span className="track-toggle-indicator">{isExpanded ? "Hide" : "Expand"}</span>
                          </button>

                          {trackMeta.length > 0 ? (
                            <div className="track-meta">
                              {trackMeta.map((item) => (
                                <span key={`${track.title}-${item}`}>{item}</span>
                              ))}
                            </div>
                          ) : null}

                          {isExpanded ? (
                            <div className="track-body">
                              {track.notes ? <p>{track.notes}</p> : null}
                              {tags.length > 0 ? (
                                <div className="pill-row">
                                  {tags.map((tag) => (
                                    <span key={`${track.title}-${tag}`}>{tag}</span>
                                  ))}
                                </div>
                              ) : null}
                              <div className="link-row">
                                {"songId" in track && track.songId ? (
                                  <Link href={`/songs/${track.songId}`}>Open player</Link>
                                ) : null}
                                {track.creativeTvUrl ? (
                                  <a href={track.creativeTvUrl} rel="noreferrer" target="_blank">
                                    Creative TV
                                  </a>
                                ) : null}
                                {track.youtubeUrl ? (
                                  <a href={track.youtubeUrl} rel="noreferrer" target="_blank">
                                    Listen
                                  </a>
                                ) : null}
                                {!track.youtubeUrl && track.listenUrl ? (
                                  <a href={track.listenUrl} rel="noreferrer" target="_blank">
                                    Search
                                  </a>
                                ) : null}
                                {track.musicbrainzUrl ? (
                                  <a href={track.musicbrainzUrl} rel="noreferrer" target="_blank">
                                    MusicBrainz
                                  </a>
                                ) : null}
                              </div>
                              {track.youtubeUrl && track.embedSourceKind !== "link_only" ? (
                                <div className="track-embed">
                                  <iframe
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    src={youtubeEmbedUrl(track.youtubeUrl)}
                                    title={`${track.title} video`}
                                  />
                                </div>
                              ) : null}
                              {track.embedSourceKind === "iframe_allowed" && track.embedIframeUrl ? (
                                <div className="track-embed">
                                  <iframe
                                    allow="encrypted-media; fullscreen"
                                    loading="lazy"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    sandbox="allow-scripts allow-same-origin allow-presentation"
                                    src={track.embedIframeUrl}
                                    title={`${track.title} embed`}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3>Set Notes</h3>
                  <ul className="mix-facts">
                    <li>Use case: {selected.useCase}</li>
                    <li>Energy arc: {selected.vibe}</li>
                    <li>Default DJ: {selected.djPersona}</li>
                    <li>Runtime target: {selected.duration}</li>
                    <li>Tracks: {selected.tracks.length}</li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="empty">Save a tape in chat to start building your listening memory.</div>
          )}
        </section>

        <aside className="explorer-panel">
          <h3>Crate Lenses</h3>
          <div className="stat-grid">
            <div>
              <strong>{mixes.length}</strong>
              <span>Tapes</span>
            </div>
            <div>
              <strong>{totalTracks}</strong>
              <span>Tracks</span>
            </div>
          </div>

          <div className="lens-grid">
            <button onClick={() => explore("")} type="button">All</button>
            <button onClick={() => explore("party")} type="button">Party</button>
            <button onClick={() => explore("warm-up")} type="button">Warm-up</button>
            <button onClick={randomMix} type="button">Random</button>
          </div>

          <div className="facet-cloud">
            <p className="eyebrow">Top facets</p>
            {facets.length > 0 ? (
              facets.map(([facet, count]) => (
                <button key={facet} onClick={() => explore(facet)} type="button">
                  <span>{facet}</span>
                  <small>{count}</small>
                </button>
              ))
            ) : (
              <span className="muted">No facets yet.</span>
            )}
          </div>

          <div className="activity-shortcuts">
            <p className="eyebrow">Recent moments</p>
            {moments.slice(0, 4).map((moment) => (
              <button
                key={moment.id}
                onClick={() => {
                  if (moment.mixId) setSelectedId(moment.mixId);
                }}
                type="button"
              >
                <span>{moment.title}</span>
                <small>{moment.kind}{moment.mixTitle ? ` / ${moment.mixTitle}` : ""}</small>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
