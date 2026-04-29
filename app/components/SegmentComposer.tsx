"use client";

import { useState } from "react";
import VoiceRecorder from "./VoiceRecorder";

type Segment = {
  id: number;
  position: number;
  kind: "music" | "voice" | "upload" | "text" | "podcast";
  title: string;
  body: string;
  audioCid: string;
  audioUrl: string;
  ttsVoice: string;
  ttsProvider: string;
  song?: { title: string; artist: string; youtubeUrl: string } | null;
};

type Voice = { id: string; label: string };

type Props = {
  stationId: number;
  segments: Segment[];
  voices: Voice[];
  defaultVoiceId: string;
  onChange: () => void;
};

type Tab = "music" | "voice" | "upload" | "text" | "podcast";

const TABS: { value: Tab; label: string }[] = [
  { value: "music", label: "Music" },
  { value: "voice", label: "Voice" },
  { value: "upload", label: "Upload" },
  { value: "text", label: "Text" },
  { value: "podcast", label: "Podcast" }
];

const APP_BASE = "/app";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${APP_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export default function SegmentComposer({ stationId, segments, voices, defaultVoiceId, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("music");

  return (
    <div className="composer">
      <div className="composer-tabs">
        {TABS.map((entry) => (
          <button
            key={entry.value}
            className={tab === entry.value ? "active" : ""}
            onClick={() => setTab(entry.value)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "music" && <MusicTab stationId={stationId} onAdded={onChange} />}
      {tab === "voice" && <VoiceRecorder stationId={stationId} onUploaded={onChange} hint="Record a 5–60 s voice update — it will pin to Pinata." />}
      {tab === "upload" && (
        <UploadTab stationId={stationId} onAdded={onChange} />
      )}
      {tab === "text" && (
        <TextTab stationId={stationId} voices={voices} defaultVoiceId={defaultVoiceId} onAdded={onChange} />
      )}
      {tab === "podcast" && <PodcastTab stationId={stationId} onAdded={onChange} />}

      <SegmentList
        stationId={stationId}
        segments={segments}
        defaultVoiceId={defaultVoiceId}
        onChange={onChange}
      />
    </div>
  );
}

function MusicTab({ stationId, onAdded }: { stationId: number; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim() || !artist.trim()) {
      setError("Title and artist are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/stations/${stationId}/segments`, {
        kind: "music",
        title: `${artist} — ${title}`,
        song: { title, artist, youtubeUrl }
      });
      setTitle("");
      setArtist("");
      setYoutubeUrl("");
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="composer-form">
      <input value={artist} placeholder="Artist" onChange={(event) => setArtist(event.target.value)} type="text" />
      <input value={title} placeholder="Track title" onChange={(event) => setTitle(event.target.value)} type="text" />
      <input
        value={youtubeUrl}
        placeholder="YouTube URL (optional)"
        onChange={(event) => setYoutubeUrl(event.target.value)}
        type="url"
      />
      <button onClick={add} disabled={busy} type="button">
        {busy ? "Adding…" : "Add to station"}
      </button>
      {error ? <p className="signin-error">{error}</p> : null}
    </div>
  );
}

function UploadTab({ stationId, onAdded }: { stationId: number; onAdded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("stationId", String(stationId));
      form.append("title", title || file.name);
      form.append("kind", "upload");
      const response = await fetch(`${APP_BASE}/api/segments/voice`, { method: "POST", body: form });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setTitle("");
      event.target.value = "";
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="composer-form">
      <p className="muted">Upload a pre-recorded MP3, WAV, or M4A (≤50 MB).</p>
      <input value={title} placeholder="Title (optional)" onChange={(event) => setTitle(event.target.value)} type="text" />
      <input type="file" accept="audio/*" onChange={handleFile} disabled={busy} />
      {busy ? <p className="muted">Uploading…</p> : null}
      {error ? <p className="signin-error">{error}</p> : null}
    </div>
  );
}

function TextTab({
  stationId,
  voices,
  defaultVoiceId,
  onAdded
}: {
  stationId: number;
  voices: Voice[];
  defaultVoiceId: string;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [voiceId, setVoiceId] = useState(defaultVoiceId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(narrate: boolean) {
    if (!body.trim()) {
      setError("Write some text first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await postJson<{ segment: { id: number } }>(`/api/stations/${stationId}/segments`, {
        kind: "text",
        title: title || "News & updates",
        body
      });
      if (narrate && voiceId) {
        try {
          await postJson(`/api/segments/text/narrate`, {
            segmentId: created.segment.id,
            voiceId
          });
        } catch (narrateErr) {
          setError(
            `Text saved, but narration failed: ${(narrateErr as Error).message}. Fix the issue (e.g. set PINATA_JWT for uploads; if you see ENOENT for voices/*.bin, restart dev so Kokoro loads from node_modules), then remove this text card and tap “Save & narrate” again.`
          );
          onAdded();
          return;
        }
      }
      setTitle("");
      setBody("");
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="composer-form">
      <input value={title} placeholder="Headline" onChange={(event) => setTitle(event.target.value)} type="text" />
      <textarea
        value={body}
        placeholder="Share an update on yourself, your business, or what you’re working on…"
        onChange={(event) => setBody(event.target.value)}
        rows={6}
        maxLength={1500}
      />
      {voices.length > 0 ? (
        <label className="composer-voice">
          <span>Narration voice</span>
          <select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="composer-actions">
        <button onClick={() => void add(false)} disabled={busy} type="button">
          Save text card
        </button>
        {voices.length > 0 ? (
          <button onClick={() => void add(true)} disabled={busy} type="button">
            {busy ? "Working…" : "Save & narrate"}
          </button>
        ) : null}
      </div>
      {error ? <p className="signin-error">{error}</p> : null}
    </div>
  );
}

function PodcastTab({ stationId, onAdded }: { stationId: number; onAdded: () => void }) {
  const [feedUrl, setFeedUrl] = useState("");
  const [episodeUrl, setEpisodeUrl] = useState("");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFeed() {
    if (!feedUrl.trim()) {
      setError("RSS feed URL required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/stations/${stationId}/podcasts`, { feedUrl });
      setFeedUrl("");
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    if (!episodeUrl.trim()) {
      setError("Episode audio URL required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/stations/${stationId}/segments`, {
        kind: "podcast",
        title: episodeTitle || "Podcast episode",
        audioUrl: episodeUrl
      });
      setEpisodeUrl("");
      setEpisodeTitle("");
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="composer-form">
      <p className="eyebrow">Subscribe to an RSS feed</p>
      <input
        value={feedUrl}
        placeholder="https://example.com/podcast.xml"
        onChange={(event) => setFeedUrl(event.target.value)}
        type="url"
      />
      <button onClick={addFeed} disabled={busy} type="button">
        Add feed & sync episodes
      </button>

      <p className="eyebrow">Or add a single episode</p>
      <input
        value={episodeTitle}
        placeholder="Episode title"
        onChange={(event) => setEpisodeTitle(event.target.value)}
        type="text"
      />
      <input
        value={episodeUrl}
        placeholder="Episode audio URL (.mp3, .m4a)"
        onChange={(event) => setEpisodeUrl(event.target.value)}
        type="url"
      />
      <button onClick={addManual} disabled={busy} type="button">
        Add episode
      </button>

      {error ? <p className="signin-error">{error}</p> : null}
    </div>
  );
}

function SegmentList({
  stationId,
  segments,
  defaultVoiceId,
  onChange
}: {
  stationId: number;
  segments: Segment[];
  defaultVoiceId: string;
  onChange: () => void;
}) {
  const [narratingId, setNarratingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function remove(id: number) {
    setError("");
    await fetch(`${APP_BASE}/api/stations/${stationId}/segments/${id}`, { method: "DELETE" });
    onChange();
  }

  async function move(id: number, direction: -1 | 1) {
    setError("");
    const current = segments.findIndex((segment) => segment.id === id);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= segments.length) return;
    const next = [...segments];
    const [item] = next.splice(current, 1);
    next.splice(target, 0, item);
    await postJson(`/api/stations/${stationId}/segments/reorder`, { ids: next.map((segment) => segment.id) });
    onChange();
  }

  async function regenerateNarration(segment: Segment) {
    if (segment.kind !== "text" || !segment.body.trim()) return;
    setNarratingId(segment.id);
    setError("");
    try {
      await postJson("/api/segments/text/narrate", {
        segmentId: segment.id,
        ...(segment.ttsVoice || defaultVoiceId ? { voiceId: segment.ttsVoice || defaultVoiceId } : {})
      });
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setNarratingId(null);
    }
  }

  if (segments.length === 0) {
    return <p className="muted">No segments yet. Add music, voice, text, uploads, or podcast episodes above.</p>;
  }

  return (
    <>
      <ol className="segment-list">
        {segments.map((segment, index) => (
          <li key={segment.id}>
            <div>
              <span className="queue-kind">{segment.kind}</span>
              <strong>{segment.title || segment.kind}</strong>
              {segment.body ? <p>{segment.body.slice(0, 120)}{segment.body.length > 120 ? "…" : ""}</p> : null}
              {segment.song ? <small>{segment.song.artist} — {segment.song.title}</small> : null}
              {segment.audioCid ? <small className="muted">cid: {segment.audioCid.slice(0, 12)}…</small> : null}
            </div>
            <div className="segment-actions">
              <button onClick={() => void move(segment.id, -1)} disabled={index === 0} type="button">↑</button>
              <button onClick={() => void move(segment.id, 1)} disabled={index === segments.length - 1} type="button">↓</button>
              {segment.kind === "text" ? (
                <button
                  onClick={() => void regenerateNarration(segment)}
                  disabled={narratingId === segment.id || !segment.body.trim()}
                  type="button"
                >
                  {narratingId === segment.id ? "Narrating…" : "Re-generate narration"}
                </button>
              ) : null}
              <button onClick={() => void remove(segment.id)} type="button">Remove</button>
            </div>
          </li>
        ))}
      </ol>
      {error ? <p className="signin-error">{error}</p> : null}
    </>
  );
}
