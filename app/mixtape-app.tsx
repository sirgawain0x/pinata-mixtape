"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { youtubeEmbedUrl, youtubePlaylistEmbed, youtubeVideoId } from "../lib/youtube";
import SignInButton from "./components/SignInButton";

export type Track = {
  title: string;
  artist: string;
  releaseYear: string;
  duration: string;
  bpm: string;
  energy: string;
  moodTags: string[];
  sceneTags: string[];
  notes: string;
  musicbrainzUrl: string;
  youtubeUrl: string;
  listenUrl: string;
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

  const selected = useMemo(
    () => mixes.find((mix) => mix.id === selectedId) ?? mixes[0] ?? null,
    [mixes, selectedId]
  );

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
  }

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

  async function copyShareLink() {
    if (!selectedId || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("mix", String(selectedId));

    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Link copied");
      window.setTimeout(() => setShareStatus(""), 1800);
    } catch {
      setShareStatus("Copy failed");
      window.setTimeout(() => setShareStatus(""), 1800);
    }
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

  const totalTracks = useMemo(
    () => new Set(mixes.flatMap((mix) => mix.tracks.map((track) => `${track.artist}::${track.title}`))).size,
    [mixes]
  );

  const mixYoutubeEmbed = useMemo(() => {
    if (!selected) return "";
    return youtubePlaylistEmbed(selected.tracks.map((track) => track.youtubeUrl));
  }, [selected]);

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
                  <button onClick={() => void copyShareLink()} type="button">
                    Share
                  </button>
                </div>
              </div>
              {shareStatus ? <p className="share-status">{shareStatus}</p> : null}

              <div className="cassette" aria-hidden="true">
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

              {mixYoutubeEmbed ? (
                <div className="mix-player">
                  <div className="mix-player-head">
                    <div>
                      <p className="eyebrow">Mix Playback</p>
                      <h3>YouTube Queue</h3>
                    </div>
                    <span>
                      {selected.tracks.filter((track) => youtubeVideoId(track.youtubeUrl)).length} direct link
                      {selected.tracks.filter((track) => youtubeVideoId(track.youtubeUrl)).length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mix-player-embed">
                    <iframe
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      src={mixYoutubeEmbed}
                      title={`${selected.title} YouTube mix`}
                    />
                  </div>
                </div>
              ) : null}

              <div className="columns">
                <div>
                  <h3>Track List</h3>
                  <div className="track-grid">
                    {selected.tracks.map((track, index) => (
                      <article className="track" key={`${track.artist}-${track.title}`}>
                        {(() => {
                          const trackMeta = [track.releaseYear, track.duration, track.energy].filter(Boolean);
                          const tags = track.moodTags.concat(track.sceneTags).filter(Boolean);

                          return (
                            <>
                        <div className="track-head">
                          <span>0{index + 1}</span>
                          <div>
                            <h4>{track.title}</h4>
                            <p>{track.artist}</p>
                          </div>
                        </div>
                        {trackMeta.length > 0 ? (
                          <div className="track-meta">
                            {trackMeta.map((item) => (
                              <span key={`${track.title}-${item}`}>{item}</span>
                            ))}
                          </div>
                        ) : null}
                        {track.notes ? <p>{track.notes}</p> : null}
                        {tags.length > 0 ? (
                          <div className="pill-row">
                            {tags.map((tag) => (
                              <span key={`${track.title}-${tag}`}>{tag}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="link-row">
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
                        {track.youtubeUrl ? (
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
                            </>
                          );
                        })()}
                      </article>
                    ))}
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
