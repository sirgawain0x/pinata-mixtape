"use client";

import LensFeed from "./LensFeed";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Creator, Mix, Station } from "../mixtape-app";
import type { Song } from "../../lib/mixtapes";
import { isTrackHiddenFromPublicPlayback } from "../../lib/track-playback-policy";
import SignInButton from "./SignInButton";
import MixtapeEditor from "./MixtapeEditor";
import DesignDialog from "./DesignDialog";
import PlaylistDetail from "./PlaylistDetail";
import PlaylistAssistant from "./PlaylistAssistant";
import PostComposer from "./PostComposer";
import { MixtapeIcon, MixtapeMark, PlaylistArt } from "./MixtapeIcons";

type Props = {
  initialMixes: Mix[];
  initialCreator: Creator | null;
  allowUnownedEditing: boolean;
  profileCreator: Pick<Creator, "id" | "displayName" | "avatarUrl" | "bio"> | null;
  initialStations: Station[];
};

export default function MixtapeHome({ initialMixes, initialCreator, profileCreator, initialStations, allowUnownedEditing }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const page = params.get("page") ?? "home";
  const selectedMix = initialMixes.find((mix) => mix.id === Number(params.get("mix")));
  const [creator, setCreator] = useState(initialCreator);
  const [editor, setEditor] = useState<{ mix: Mix | null; draft?: Partial<Mix> } | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [postRefresh, setPostRefresh] = useState(0);
  const [postOpen, setPostOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ mixes: Mix[]; songs: Song[] } | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mine = page === "me";
  const profile = page === "profile";
  const owner = mine ? creator : profile ? profileCreator : null;
  const mixes = useMemo(() => mine || profile ? initialMixes.filter((mix) => owner && mix.creatorId === owner.id) : initialMixes, [initialMixes, mine, profile, owner]);
  const tracks = useMemo(() => {
    const seen = new Set<string>();
    return mixes.flatMap((mix) => mix.tracks.map((track, index) => ({ track, index, mix }))).filter(({ track }) => {
      const key = String(track.songId ?? `${track.title}-${track.artist}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return !isTrackHiddenFromPublicPlayback(track);
    });
  }, [mixes]);

  const onAuthChange = useCallback(async (state: { sessionReady: boolean; address: string } | null) => {
    if (!state?.sessionReady) { if (!state) { setCreator(null); router.refresh(); } return; }
    try {
      const response = await fetch("/app/api/creators/me", { cache: "no-store" });
      if (response.ok) { const data = await response.json(); setCreator(data.creator); router.refresh(); }
    } catch { setNotice("Could not refresh your profile. Please reload the page."); }
  }, [router]);

  useEffect(() => { setCreator(initialCreator); }, [initialCreator]);
  useEffect(() => {
    if (params.get("editor") === "new") setAssistantOpen(true);
  }, [params]);

  useEffect(() => {
    if (!searchOpen) return;
    const controller = new AbortController();
    setSearching(true);
    setSearchError("");
    setResults(null);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/app/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Search is unavailable.");
        setResults(data);
      } catch (error) {
        if (!controller.signal.aborted) { setSearchError((error as Error).message); setResults(null); }
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, searchOpen]);

  function openSearch() { setSearchOpen(true); }
  function saved(mix: Mix) { setNotice("Your playlist is saved."); router.push(`/?mix=${mix.id}`); router.refresh(); }
  const visibleSearchMixes = results?.mixes.filter((mix) => !mine && !profile || mix.creatorId === owner?.id) ?? [];
  const visibleSearchSongs = results?.songs.filter((song) => !mine && !profile || visibleSearchMixes.some((mix) => song.mixIds.includes(mix.id))) ?? [];

  return <main id="mixtape-ui" className="mixtape-ui">
    <div className="mt-page">
      <header className="mt-header">
        <Link href="/" className="mt-brand" aria-label="Creative Mixtape home"><MixtapeMark/><span>MIXTAPE</span></Link>
        <nav className="mt-header-nav" aria-label="Main navigation">
          <Link href="/?page=me" className={`mt-me ${mine ? "mt-selected" : ""}`} aria-current={mine ? "page" : undefined}>ME</Link>
          <div className="mt-auth"><SignInButton initialCreator={initialCreator ? { address: initialCreator.walletAddress } : null}
            onChange={onAuthChange} onNewTape={() => setAssistantOpen(true)}/></div>
          <button type="button" className={`mt-menu-button ${menuOpen ? "mt-selected" : ""}`} aria-expanded={menuOpen} aria-label="Open navigation" onClick={() => setMenuOpen(true)}>☰</button>
        </nav>
      </header>
      <nav className="mt-create-bar" aria-label="Create and explore">
        <button type="button" onClick={() => setAssistantOpen(true)}><MixtapeIcon name="playlist"/><span>PLAYLIST</span></button>
        <button type="button" aria-haspopup="dialog" aria-expanded={postOpen} onClick={() => setPostOpen(true)}><MixtapeIcon name="post"/><span>POST</span></button>
        <Link href="/?page=tracks" aria-current={page === "tracks" ? "page" : undefined}><MixtapeIcon name="track"/><span>TRACK</span></Link>
      </nav>
      {notice ? <div className="mt-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div> : null}
      {selectedMix ? <PlaylistDetail key={selectedMix.id} mix={selectedMix} trackIndex={Math.max(0, Number(params.get("track")) || 0)}
        canEdit={Boolean(creator && selectedMix.creatorId === creator.id || selectedMix.creatorId == null && allowUnownedEditing)} onEdit={() => setEditor({ mix: selectedMix })}/> : <>
        {mine || profile ? <section className="mt-profile">
          <div className="mt-avatar" aria-hidden="true">{(owner?.displayName || "M").slice(0, 1).toUpperCase()}</div>
          <div><p className="mt-kicker">{mine ? "YOUR CORNER OF MIXTAPE" : "CREATOR PROFILE"}</p>
            <h1>{owner?.displayName || (mine ? "Make yourself at home." : "Creator not found")}</h1>
            <p>{owner?.bio || (mine ? "Your playlists, your sound, your people." : "Discover their rotation.")}</p>
            {owner ? <p className="mt-profile-stats">{mixes.length} playlists <span>·</span> {tracks.length} tracks</p> : null}
          </div>
          {mine && creator ? <button type="button" onClick={() => setProfileOpen(true)}>Edit profile</button> : null}
          {mine && !creator ? <p className="mt-note">Sign in above to see and create your playlists.</p> : null}
        </section> : null}
        {page !== "tracks" ? <section className="mt-section" aria-labelledby="playlist-heading">
          <div className="mt-section-heading"><h2 id="playlist-heading">{mine ? <em>ME </em> : null}PLAYLISTS</h2>
            {page !== "playlists" ? <Link href={mine ? "/?page=me&all=1" : "/?page=playlists"}>View all ↗</Link> : <span>{mixes.length} in rotation</span>}
          </div>
          <div className={page === "playlists" || params.get("all") === "1" ? "mt-playlist-grid" : "mt-playlist-rail"}>
            {mixes.map((mix) => <Link key={mix.id} className="mt-playlist-card" href={`/?mix=${mix.id}`}>
              <PlaylistArt title={mix.title} id={mix.id}/><span className="mt-card-overlay"/>
              <span className="mt-card-top"><strong>{mix.title}</strong><small>{mix.genre || mix.vibe || "Mixtape"}</small></span>
              <span className="mt-card-bottom"><span>{mix.creators?.join(" / ") || mix.djPersona || "Creative Mixtape"}</span><span>{mix.tracks.length} tracks <b>↗</b></span></span>
            </Link>)}
            {!profile && mixes.length > 0 ? <button type="button" className="mt-playlist-card mt-create-card" onClick={() => setAssistantOpen(true)}><MixtapeIcon name="playlist"/><strong>Your next mix</strong><span>Create a playlist ＋</span></button> : null}
            {!mixes.length ? <div className="mt-empty"><h3>{mine ? "Your next favorite mix starts here." : "No playlists yet."}</h3><p>Create a playlist and give it your own spin.</p><button type="button" onClick={() => setAssistantOpen(true)}>Create a playlist ＋</button></div> : null}
          </div>
        </section> : null}
        <button className="mt-search-trigger" type="button" onClick={openSearch}><MixtapeIcon name="search"/><span>Search playlists, artists, tracks</span><MixtapeIcon name="arrow"/></button>
        <section className="mt-section" aria-labelledby="track-heading">
          <div className="mt-section-heading"><h2 id="track-heading">{mine ? <em>ME </em> : null}TRACKS</h2><span>{tracks.length} discoveries</span></div>
          <div className="mt-song-grid">{(page === "tracks" ? tracks : tracks.slice(0, 6)).map(({ track, mix, index }) => <Link key={track.songId ?? `${mix.id}-${index}`} className="mt-song-tile" href={`/?mix=${mix.id}&track=${index}`}>
            <PlaylistArt compact title={track.title} id={track.songId ?? index}/><span><strong>{track.title}</strong><small>{track.artist}</small></span><MixtapeIcon name="track"/>
          </Link>)}</div>
          {!tracks.length ? <p className="mt-empty-copy">Tracks you add to playlists will appear here.</p> : null}
        </section>
        {page !== "tracks" ? <>
          <section className="mt-section"><div className="mt-section-heading"><h2>ON AIR</h2><Link href="/dashboard">Host a station ↗</Link></div>
            <div className="mt-station-grid">{initialStations.filter((station) => !mine && !profile || station.creatorId === owner?.id).map((station) => <Link key={station.id} href={`/s/${station.handle}`} className="mt-station-card"><MixtapeIcon name="live"/><span><strong>{station.name}</strong><small>{station.tagline || `@${station.handle}`}</small></span><span>Listen ↗</span></Link>)}</div>
            {!initialStations.filter((station) => !mine && !profile || station.creatorId === owner?.id).length ? <p className="mt-empty-copy">The airwaves are open. Create a station to start broadcasting.</p> : null}
          </section>
        </> : null}
      </>}
      {!selectedMix && page !== "tracks" && (!(mine || profile) || owner) ? <LensFeed refreshKey={postRefresh} creatorId={mine || profile ? owner?.id : undefined}/> : null}
      <footer className="mt-footer"><MixtapeMark small/><span>Made for the love of the mix.</span><Link href="/dashboard">Creator studio ↗</Link></footer>
    </div>
    {editor ? <MixtapeEditor mix={editor.mix} initialDraft={editor.draft} onClose={() => setEditor(null)} onSaved={saved}/> : null}
    {assistantOpen ? <PlaylistAssistant signedIn={Boolean(creator)} onClose={() => setAssistantOpen(false)} onReview={(draft) => { setAssistantOpen(false); setEditor({ mix: null, draft }); }} onForm={() => { setAssistantOpen(false); setEditor({ mix: null }); }}/> : null}
    {postOpen ? <PostComposer mixes={initialMixes} initialMixId={selectedMix?.isPublic ? selectedMix.id : undefined} onClose={() => { setPostOpen(false); setPostRefresh((value) => value + 1); }}/> : null}
    {profileOpen && creator ? <ProfileEditor creator={creator} onClose={() => setProfileOpen(false)} onSaved={(next) => { setCreator(next); router.refresh(); }}/>: null}
    {menuOpen ? <DesignDialog title="Explore Mixtape" onClose={() => setMenuOpen(false)}><nav className="mt-menu-links" aria-label="Explore">
      {[{ href: "/", label: "Home" }, { href: "/?page=me", label: "My page" }, { href: "/?page=playlists", label: "Playlists" }, { href: "/?page=tracks", label: "Tracks" }, { href: "/dashboard", label: "Creator studio" }].map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label} ↗</Link>)}
    </nav></DesignDialog> : null}
    {searchOpen ? <DesignDialog title="Find your next rotation" className="mt-search-sheet" onClose={() => setSearchOpen(false)}>
      <form className="mt-search-form" onSubmit={(event) => { event.preventDefault(); searchInputRef.current?.focus(); }}>
        <MixtapeIcon name="search"/><input ref={searchInputRef} data-dialog-autofocus autoFocus value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search playlists and tracks" placeholder="Artist, song, genre, or playlist"/><button type="submit" aria-label="Search"><MixtapeIcon name="arrow"/></button>
      </form>
      <p className="mt-note" role="status">{searching ? "Searching your crate…" : `${visibleSearchMixes.length} playlists · ${visibleSearchSongs.length} tracks`}</p>
      {searchError ? <p role="alert" className="mt-error">{searchError}</p> : null}
      <h3>PLAYLISTS</h3><div className="mt-search-results">{visibleSearchMixes.map((mix) => <Link key={mix.id} href={`/?mix=${mix.id}`} onClick={() => setSearchOpen(false)}><PlaylistArt compact title={mix.title} id={mix.id}/><span><strong>{mix.title}</strong><small>{mix.genre || mix.vibe}</small></span><span>↗</span></Link>)}</div>
      <h3>TRACKS</h3><div className="mt-search-results">{visibleSearchSongs.map((song) => {
        const containing = visibleSearchMixes.find((mix) => mix.tracks.some((track) => track.songId === song.id));
        const index = containing?.tracks.findIndex((track) => track.songId === song.id) ?? 0;
        return <Link key={song.id} href={containing ? `/?mix=${containing.id}&track=${index}` : `/songs/${song.id}`} onClick={() => setSearchOpen(false)}><PlaylistArt compact title={song.title} id={song.id}/><span><strong>{song.title}</strong><small>{song.artist}</small></span><span>↗</span></Link>;
      })}</div>
      {!searching && !searchError && !visibleSearchMixes.length && !visibleSearchSongs.length ? <p className="mt-empty-copy">Nothing in this crate yet. Try another artist, title, or genre.</p> : null}
    </DesignDialog> : null}
  </main>;
}

function ProfileEditor({ creator, onClose, onSaved }: { creator: Creator; onClose: () => void; onSaved: (creator: Creator) => void }) {
  const [name, setName] = useState(creator.displayName);
  const [bio, setBio] = useState(creator.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/app/api/creators/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name.trim(), bio: bio.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your profile.");
      onSaved(data.creator); onClose();
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <DesignDialog title="Edit your profile" onClose={onClose}><form className="mt-profile-form" onSubmit={save}>
    <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required/></label>
    <label>Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={1000} rows={4}/></label>
    {error ? <p className="mt-error" role="alert">{error}</p> : null}<button className="mt-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
  </form></DesignDialog>;
}
