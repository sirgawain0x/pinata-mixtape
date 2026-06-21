"use client";

import { useCallback, useEffect, useState } from "react";

export type MbRecording = {
  id: string;
  title: string;
  artistCredit: string;
  firstReleaseDate: string;
  url: string;
};

type Props = {
  onSelect: (recording: MbRecording) => void;
};

const APP_BASE = "/app";

export default function MusicBrainzLookup({ onSelect }: Props) {
  const [mbTitle, setMbTitle] = useState("");
  const [mbArtist, setMbArtist] = useState("");
  const [mbResults, setMbResults] = useState<MbRecording[]>([]);
  const [mbBusy, setMbBusy] = useState(false);
  const [mbError, setMbError] = useState("");

  const searchMb = useCallback(async (signal?: AbortSignal) => {
    if (!mbTitle.trim() && !mbArtist.trim()) return;
    setMbBusy(true);
    setMbError("");
    try {
      const params = new URLSearchParams();
      if (mbTitle.trim()) params.set("title", mbTitle.trim());
      if (mbArtist.trim()) params.set("artist", mbArtist.trim());
      params.set("limit", "6");
      const response = await fetch(`${APP_BASE}/api/musicbrainz/recordings?${params}`, { signal });
      const data = (await response.json()) as { recordings?: MbRecording[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "MusicBrainz search failed.");
      setMbResults(data.recordings ?? []);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMbError((err as Error).message);
      setMbResults([]);
    } finally {
      if (!signal?.aborted) setMbBusy(false);
    }
  }, [mbArtist, mbTitle]);

  useEffect(() => {
    if (!mbTitle.trim() && !mbArtist.trim()) {
      setMbResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchMb(controller.signal);
    }, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mbArtist, mbTitle, searchMb]);

  return (
    <section className="editor-mb-section">
      <p className="eyebrow">Identify track (MusicBrainz)</p>
      <p className="muted editor-mb-hint">Search to fill title and artist. Add a YouTube or embed URL below for in-app playback.</p>
      <div className="editor-grid">
        <input
          onChange={(event) => setMbTitle(event.target.value)}
          placeholder="Track title"
          type="text"
          value={mbTitle}
        />
        <input
          onChange={(event) => setMbArtist(event.target.value)}
          placeholder="Artist"
          type="text"
          value={mbArtist}
        />
      </div>
      {mbBusy ? <p className="muted">Searching MusicBrainz…</p> : null}
      {mbError ? <p className="signin-error">{mbError}</p> : null}
      {mbResults.length > 0 ? (
        <ul className="mb-results">
          {mbResults.map((recording) => (
            <li key={recording.id}>
              <button
                onClick={() => {
                  onSelect(recording);
                  setMbResults([]);
                  setMbTitle("");
                  setMbArtist("");
                }}
                type="button"
              >
                {recording.title} — {recording.artistCredit}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
