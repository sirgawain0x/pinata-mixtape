"use client";

import { FormEvent, useState } from "react";
import type { EmbedSourceKind } from "../../lib/embed-sources";
import { getTrackPlaybackStatus } from "../../lib/song-playback";
import type { Mix, Track } from "../mixtape-app";
import MusicBrainzLookup, { type MbRecording } from "./MusicBrainzLookup";
import TrackPreview from "./TrackPreview";

const APP_BASE = "/app";

type DraftTrack = {
  title: string;
  artist: string;
  releaseYear: string;
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
};

function trackToDraft(track: Track): DraftTrack {
  return {
    title: track.title,
    artist: track.artist,
    releaseYear: track.releaseYear,
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

export default function MixtapeEditor({ mix, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(mix?.title ?? "");
  const [description, setDescription] = useState(mix?.description ?? "");
  const [vibe, setVibe] = useState(mix?.vibe ?? "");
  const [useCase, setUseCase] = useState(mix?.useCase ?? "");
  const [djPersona, setDjPersona] = useState(mix?.djPersona ?? "Velvet Static");
  const [isPublic, setIsPublic] = useState(mix?.isPublic ?? true);
  const [slug, setSlug] = useState(mix?.slug ?? "");
  const [tracks, setTracks] = useState<DraftTrack[]>(mix?.tracks.map(trackToDraft) ?? []);
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
      musicbrainzId: recording.id,
      musicbrainzUrl: recording.url
    }));
  }

  function addDraftTrack() {
    if (!draft.title.trim() || !draft.artist.trim()) {
      setError("Each track needs a title and artist.");
      return;
    }
    setTracks((current) => [...current, { ...draft }]);
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
    if (previewTrackIndex === index) setPreviewTrackIndex(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Mix title is required.");
      return;
    }

    const linkOnlyCount = tracks.filter((track) => getTrackPlaybackStatus(track) === "link_only").length;
    if (linkOnlyCount > 0 && !window.confirm(`${linkOnlyCount} track(s) only have search/listen links and won't play in-app. Save anyway?`)) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
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
    <div className="modal-backdrop" role="presentation">
      <form aria-modal="true" className="confirm-modal mixtape-editor-modal" onSubmit={save} role="dialog">
        <p className="eyebrow">{mix ? "Edit tape" : "New tape"}</p>
        <h3>{mix ? mix.title : "Create a mixtape"}</h3>

        <label className="modal-field">
          <span>Title</span>
          <input onChange={(event) => setTitle(event.target.value)} required type="text" value={title} />
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
                  placeholder="Title"
                  type="text"
                  value={draft.title}
                />
                <input
                  onChange={(event) => setDraft((current) => ({ ...current, artist: event.target.value }))}
                  placeholder="Artist"
                  type="text"
                  value={draft.artist}
                />
              </div>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, youtubeUrl: event.target.value }))}
                placeholder="YouTube URL (playback)"
                type="url"
                value={draft.youtubeUrl}
              />
              <input
                onChange={(event) => setDraft((current) => ({ ...current, creativeTvUrl: event.target.value }))}
                placeholder="Creative TV discover URL"
                type="url"
                value={draft.creativeTvUrl}
              />
              <input
                onChange={(event) => setDraft((current) => ({ ...current, listenUrl: event.target.value }))}
                placeholder="Listen / search link"
                type="url"
                value={draft.listenUrl}
              />
              <input
                onChange={(event) => setDraft((current) => ({ ...current, embedIframeUrl: event.target.value }))}
                placeholder="Spotify / SoundCloud / Bandcamp embed URL (optional)"
                type="url"
                value={draft.embedIframeUrl}
              />
              <select
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
            {busy ? "Saving…" : mix ? "Save tape" : "Create tape"}
          </button>
        </div>
      </form>
    </div>
  );
}
