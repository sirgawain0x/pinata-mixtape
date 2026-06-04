"use client";

import { FormEvent, useState } from "react";

const APP_BASE = "/app";

export default function AdminSongsClient() {
  const [songId, setSongId] = useState("");
  const [token, setToken] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const id = Number(songId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Enter a valid song ID.");
      return;
    }
    if (!token.trim()) {
      setError("Admin write token required.");
      return;
    }
    if (!file) {
      setError("Choose an audio file.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${APP_BASE}/api/songs/${id}/audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token.trim()}` },
        body: form
      });
      const data = (await response.json()) as { song?: { title: string }; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setMessage(`Uploaded curated audio for “${data.song?.title ?? "song"}”.`);
      setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-songs-form" onSubmit={upload}>
      <label className="modal-field">
        <span>Song ID</span>
        <input onChange={(event) => setSongId(event.target.value)} required type="number" value={songId} />
      </label>
      <label className="modal-field">
        <span>Admin token (MIXTAPE_WRITE_TOKEN)</span>
        <input
          autoComplete="off"
          onChange={(event) => setToken(event.target.value)}
          required
          type="password"
          value={token}
        />
      </label>
      <label className="modal-field">
        <span>Competition audio file</span>
        <input
          accept="audio/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
          type="file"
        />
      </label>
      <button disabled={busy} type="submit">
        {busy ? "Uploading…" : "Upload curated audio"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
      {error ? <p className="signin-error">{error}</p> : null}
    </form>
  );
}
