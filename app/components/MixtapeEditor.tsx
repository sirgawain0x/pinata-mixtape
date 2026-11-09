"use client";

import { FormEvent, useState } from "react";
import type { EmbedSourceKind } from "../../lib/embed-sources";
import { buildYoutubeSearchUrl, isYoutubeSearchUrl } from "../../lib/recording-links";
import type { Mix, Track } from "../mixtape-app";
import MusicBrainzLookup, { type MbRecording } from "./MusicBrainzLookup";
import TrackPreview from "./TrackPreview";
import DesignDialog from "./DesignDialog";

const APP_BASE = "/app";

type DraftTrack = {
  title: string;
  artist: string;
  releaseYear: string;
  releaseDate: string;
  albumTitle: string;
  duration: string;
  bpm: string;
  energy: string;
  moodTags: string[];
  sceneTags: string[];
  youtubeUrl: string;
  creativeTvUrl: string;
  listenUrl: string;
  musicbrainzId: string;
  musicbrainzUrl: string;
  embedSourceKind: EmbedSourceKind;
  embedIframeUrl: string;
  notes: string;
};

type Props = {
  mix: Mix | null;
  onClose: () => void;
  onSaved: (mix: Mix) => void;
  initialDraft?: Partial<Mix>;
};

function trackToDraft(track: Track): DraftTrack {
  return {
    title: track.title,
    artist: track.artist,
    releaseYear: track.releaseYear,
    releaseDate: track.releaseDate ?? "",
    albumTitle: track.albumTitle ?? "",
    duration: track.duration,
    bpm: track.bpm,
    energy: track.energy,
    moodTags: track.moodTags,
    sceneTags: track.sceneTags,
    youtubeUrl: track.youtubeUrl,
    creativeTvUrl: track.creativeTvUrl ?? "",
    listenUrl: track.listenUrl,
    musicbrainzId: track.musicbrainzId ?? "",
    musicbrainzUrl: track.musicbrainzUrl,
    embedSourceKind: track.embedSourceKind ?? "youtube",
    embedIframeUrl: track.embedIframeUrl ?? "",
    notes: track.notes
  };
}

const emptyDraft = (): DraftTrack => ({
  title: "",
  artist: "",
  releaseYear: "",
  releaseDate: "",
  albumTitle: "",
  duration: "",
  bpm: "",
  energy: "",
  moodTags: [],
  sceneTags: [],
  youtubeUrl: "",
  creativeTvUrl: "",
  listenUrl: "",
  musicbrainzId: "",
  musicbrainzUrl: "",
  embedSourceKind: "youtube",
  embedIframeUrl: "",
  notes: ""
});

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json()) as T & { error?: string };
}

export default function MixtapeEditor({ mix, onClose, onSaved, initialDraft }: Props) {
  const source = mix ?? initialDraft;
  const [creators, setCreators] = useState(source?.creators?.join(", ") ?? "");
  const [genre, setGenre] = useState(source?.genre ?? "");
  const [sourceUrl, setSourceUrl] = useState(source?.sourceUrl ?? "");
  const [title, setTitle] = useState(source?.title ?? "");
  const [description, setDescription] = useState(source?.description ?? "");
  const [vibe, setVibe] = useState(source?.vibe ?? "");
  const [useCase, setUseCase] = useState(mix?.useCase ?? "");
  const [djPersona, setDjPersona] = useState(mix?.djPersona ?? "Velvet Static");
  const [isPublic, setIsPublic] = useState(mix?.isPublic ?? true);
  const [slug, setSlug] = useState(mix?.slug ?? "");
  const [tracks, setTracks] = useState<DraftTrack[]>(source?.tracks?.map(trackToDraft) ?? []);
  const [draft, setDraft] = useState<DraftTrack>(emptyDraft());
  const [previewTrackIndex, setPreviewTrackIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function applyMb(recording: MbRecording) {
    setDraft((current) => ({
      ...current,
      title: recording.title || current.title,
      artist: recording.artistCredit || current.artist,
      releaseYear: recording.firstReleaseDate ? recording.firstReleaseDate.slice(0, 4) : current.releaseYear,
      releaseDate: recording.firstReleaseDate || current.releaseDate,
      albumTitle: recording.releaseTitles?.[0] || current.albumTitle,
      musicbrainzId: recording.id,
      musicbrainzUrl: recording.url,
      listenUrl: current.listenUrl && !isYoutubeSearchUrl(current.listenUrl)
        ? current.listenUrl
        : buildYoutubeSearchUrl(recording.title, recording.artistCredit)
    }));
    if (!draft.listenUrl || isYoutubeSearchUrl(draft.listenUrl)) {
      findListeningLink({
        musicbrainzId: recording.id,
        title: recording.title,
        artist: recording.artistCredit,
        albumTitle: recording.releaseTitles?.[0] ?? ""
      });
    }
  }

  function findListeningLink(recording: Pick<DraftTrack, "musicbrainzId" | "title" | "artist" | "albumTitle">) {
    const params = new URLSearchParams({
      findLink: "1",
      recordingId: recording.musicbrainzId,
      title: recording.title,
      artist: recording.artist,
      album: recording.albumTitle
    });
    void fetch(`${APP_BASE}/api/musicbrainz/recordings?${params}`)
      .then((response) => response.ok ? response.json() : null)
      .then((result: { listenUrl?: string } | null) => {
        const listenUrl = result?.listenUrl;
        if (!listenUrl) return;
        const applyListeningLink = (track: DraftTrack): DraftTrack =>
          track.musicbrainzId === recording.musicbrainzId && track.title === recording.title &&
          track.artist === recording.artist && (!track.listenUrl || isYoutubeSearchUrl(track.listenUrl))
            ? { ...track, listenUrl }
            : track;
        setDraft(applyListeningLink);
        setTracks((current) => current.map(applyListeningLink));
      }).catch(() => {});
  }

  function addDraftTrack() {
    if (!draft.title.trim() || !draft.artist.trim()) {
      setError("Each track needs a title and artist.");
      return;
    }
    setTracks((current) => [...current, {
      ...draft,
      listenUrl: draft.listenUrl || buildYoutubeSearchUrl(draft.title, draft.artist)
    }]);
    if (!draft.musicbrainzId && !draft.youtubeUrl && !draft.creativeTvUrl && !draft.embedIframeUrl &&
      (!draft.listenUrl || isYoutubeSearchUrl(draft.listenUrl))) findListeningLink(draft);
    setDraft(emptyDraft());
    setError("");
  }

  function moveTrack(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= tracks.length) return;
    setTracks((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  function removeTrack(index: number) {
    setTracks((current) => current.filter((_, i) => i !== index));
    setPreviewTrackIndex((current) => {
      if (current == null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Mix title is required.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        creators: creators.split(",").map((name) => name.trim()).filter(Boolean),
        genre,
        sourceUrl,
        description,
        vibe,
        useCase,
        djPersona,
        isPublic,
        slug: slug.trim() || undefined,
        publish: isPublic,
        tracks: tracks.map((track) => ({
          title: track.title,
          artist: track.artist,
          releaseYear: track.releaseYear,
          releaseDate: track.releaseDate,
          albumTitle: track.albumTitle,
          duration: track.duration,
          bpm: track.bpm,
          energy: track.energy,
          moodTags: track.moodTags,
          sceneTags: track.sceneTags,
          youtubeUrl: track.youtubeUrl,
          creativeTvUrl: track.creativeTvUrl,
          listenUrl: track.listenUrl,
          musicbrainzId: track.musicbrainzId,
          musicbrainzUrl: track.musicbrainzUrl,
          embedSourceKind: track.embedSourceKind,
          embedIframeUrl: track.embedIframeUrl,
          notes: track.notes
        }))
      };

      const response = mix
        ? await fetch(`${APP_BASE}/api/mixes/${mix.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          })
        : await fetch(`${APP_BASE}/api/mixes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

      const data = await readJson<{ mix: Mix }>(response);
      if (!response.ok || !data.mix) throw new Error(data.error ?? "Save failed.");
      onSaved(data.mix);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DesignDialog title={mix ? "Edit playlist" : "Create a playlist"} onClose={onClose} className="mt-editor-dialog">
      <form className="confirm-modal mixtape-editor-modal" onSubmit={save}>
        <p className="eyebrow">{mix ? "Make it yours" : "Start a new rotation"}</p>

        <label className="modal-field">
          <span>Playlist name</span>
          <input onChange={(event) => setTitle(event.target.value)} required type="text" value={title} />
        </label>
        <div className="editor-grid">
          <label className="modal-field"><span>Creators</span>
            <input value={creators} onChange={(event) => setCreators(event.target.value)} placeholder="Names, separated by commas" maxLength={2400} />
          </label>
          <label className="modal-field"><span>Genre</span>
            <input value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="House, soul, Afro…" maxLength={80} />
          </label>
        </div>
        <label className="modal-field"><span>Playlist URL</span>
          <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" type="url" maxLength={2048} />
        </label>
        <label className="modal-field">
          <span>Description</span>
          <textarea onChange={(event) => setDescription(event.target.value)} rows={2} value={description} />
        </label>
        <div className="editor-grid">
          <label className="modal-field">
            <span>Vibe / arc</span>
            <input onChange={(event) => setVibe(event.target.value)} type="text" value={vibe} />
          </label>
          <label className="modal-field">
            <span>Use case</span>
            <input onChange={(event) => setUseCase(event.target.value)} type="text" value={useCase} />
          </label>
          <label className="modal-field">
            <span>DJ persona</span>
            <input onChange={(event) => setDjPersona(event.target.value)} type="text" value={djPersona} />
          </label>
          <label className="modal-field">
            <span>Share slug</span>
            <input onChange={(event) => setSlug(event.target.value)} placeholder="neon-rooftop" type="text" value={slug} />
          </label>
        </div>
        <label className="modal-field">
          <input checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} type="checkbox" /> Public tape
        </label>

        <div className="editor-tracks">
          <p className="eyebrow">Tracks ({tracks.length})</p>
          <ol className="editor-track-list">
            {tracks.map((track, index) => (
              <li key={`${track.artist}-${track.title}-${index}`}>
                <span>
                  {String(index + 1).padStart(2, "0")} {track.title} — {track.artist}
                </span>
                <span className="editor-track-actions">
                  <button onClick={() => setPreviewTrackIndex(previewTrackIndex === index ? null : index)} type="button">
                    {previewTrackIndex === index ? "Hide" : "Preview"}
                  </button>
                  <button onClick={() => moveTrack(index, -1)} type="button">
                    ↑
                  </button>
                  <button onClick={() => moveTrack(index, 1)} type="button">
                    ↓
                  </button>
                  <button onClick={() => removeTrack(index)} type="button">
                    Remove
                  </button>
                </span>
                {previewTrackIndex === index ? <TrackPreview compact track={track} /> : null}
              </li>
            ))}
          </ol>

          <div className="editor-add-track">
            <MusicBrainzLookup onSelect={applyMb} />

            <section className="editor-links-section">
              <p className="eyebrow">Playback links</p>
              <div className="editor-grid">
                <input
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  aria-label="Song title"
                  placeholder="Title"
                  type="text"
                  value={draft.title}
                />
                <input
                  onChange={(event) => setDraft((current) => ({ ...current, artist: event.target.value }))}
                  aria-label="Song artist"
                  placeholder="Artist"
                  type="text"
                  value={draft.artist}
                />
              </div>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, youtubeUrl: event.target.value }))}
                aria-label="YouTube playback URL"
                placeholder="YouTube URL (playback)"
                type="url"
                value={draft.youtubeUrl}
              />
              <input
                onChange={(event) => setDraft((current) => ({ ...current, creativeTvUrl: event.target.value }))}
                aria-label="Creative TV discover URL"
                placeholder="Creative TV discover URL"
                type="url"
                value={draft.creativeTvUrl}
              />
              <input
                onChange={(event) => setDraft((current) => ({ ...current, listenUrl: event.target.value }))}
                aria-label="Listening URL"
                placeholder="Recording link (YouTube, Spotify, Apple Music or SoundCloud)"
                type="url"
                value={draft.listenUrl}
              />
              <input
                onChange={(event) => setDraft((current) => ({ ...current, embedIframeUrl: event.target.value }))}
                aria-label="Embed URL"
                placeholder="Spotify / SoundCloud / Bandcamp embed URL (optional)"
                type="url"
                value={draft.embedIframeUrl}
              />
              <select aria-label="Playback source"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    embedSourceKind: event.target.value as EmbedSourceKind
                  }))
                }
                value={draft.embedSourceKind}
              >
                <option value="youtube">YouTube playback</option>
                <option value="creativetv">Creative TV</option>
                <option value="iframe_allowed">Allowed iframe embed</option>
                <option value="link_only">Link only (no embed)</option>
              </select>
            </section>

            <div className="editor-grid">
              <label className="modal-field"><span>Release date</span><input value={draft.releaseDate} placeholder="YYYY, YYYY-MM, or YYYY-MM-DD" onChange={(event) => setDraft((current) => ({ ...current, releaseDate: event.target.value, releaseYear: event.target.value.slice(0, 4) }))}/></label>
              <label className="modal-field"><span>Album</span><input value={draft.albumTitle} onChange={(event) => setDraft((current) => ({ ...current, albumTitle: event.target.value }))}/></label>
            </div>
            <section className="editor-preview-section">
              <TrackPreview label="Preview track" track={draft} />
              <button onClick={addDraftTrack} type="button">
                Add track to tape
              </button>
            </section>
          </div>
        </div>

        {error ? <p className="signin-error">{error}</p> : null}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button disabled={busy} type="submit">
            {busy ? "Saving…" : mix ? "Save playlist" : "Mix it"}
          </button>
        </div>
      </form>
    </DesignDialog>
  );
}
