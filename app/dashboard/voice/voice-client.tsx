"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Creator = {
  id: number;
  walletAddress: string;
  displayName: string;
  ttsProvider: string;
  ttsVoiceId: string;
};

type VoiceClone = {
  id: number;
  provider: string;
  externalVoiceId: string;
  displayName: string;
  status: "PENDING" | "ACTIVE" | "FAILED";
  createdAt: string;
};

type Voice = { id: string; label: string };

const APP_BASE = "/app";
const CONSENT_PHRASE = "I authorize my voice for use on my Pinata Mixtape Radio station.";
const VOICE_PREVIEW_TEXT =
  "Hello — this is a quick preview of this voice for your Pinata Mixtape radio station.";

export default function VoiceClient({
  creator,
  initialClones,
  mosiAvailable
}: {
  creator: Creator;
  initialClones: VoiceClone[];
  mosiAvailable: boolean;
}) {
  const [clones, setClones] = useState(initialClones);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [defaultVoiceId, setDefaultVoiceId] = useState(creator.ttsVoiceId || "kokoro:af_heart");
  const [busy, setBusy] = useState(false);
  const [previewBusyVoiceId, setPreviewBusyVoiceId] = useState<string | null>(null);
  const [deletingCloneId, setDeletingCloneId] = useState<number | null>(null);
  const [ttsPreviewUrl, setTtsPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [displayName, setDisplayName] = useState(`${creator.displayName || creator.walletAddress.slice(0, 8)} voice`);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const ttsPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (ttsPreviewUrlRef.current) {
        URL.revokeObjectURL(ttsPreviewUrlRef.current);
        ttsPreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ttsPreviewUrl) return;
    const el = ttsPreviewAudioRef.current;
    if (!el) return;
    el.load();
    void el.play().catch(() => {
      setError("Preview could not play in this browser. Try tapping play on the player.");
    });
  }, [ttsPreviewUrl]);

  const refresh = useCallback(async () => {
    const response = await fetch(`${APP_BASE}/api/voice-clones`, { cache: "no-store" });
    const data = (await response.json()) as { voiceClones: VoiceClone[] };
    setClones(data.voiceClones);
  }, []);

  const syncDefaultFromServer = useCallback(async () => {
    const response = await fetch(`${APP_BASE}/api/auth/me`, { cache: "no-store" });
    const data = (await response.json()) as { creator: Creator | null };
    if (data.creator?.ttsVoiceId) setDefaultVoiceId(data.creator.ttsVoiceId);
  }, []);

  useEffect(() => {
    void fetch(`${APP_BASE}/api/voices`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { voices: Voice[]; defaultVoiceId?: string }) => {
        setVoices(data.voices);
        if (!creator.ttsVoiceId && data.defaultVoiceId) setDefaultVoiceId(data.defaultVoiceId);
      })
      .catch(() => undefined);
  }, [creator.ttsVoiceId]);

  useEffect(() => {
    const pending = clones.filter((clone) => clone.status === "PENDING");
    if (pending.length === 0) return;
    const interval = window.setInterval(() => {
      Promise.all(
        pending.map((clone) =>
          fetch(`${APP_BASE}/api/voice-clones/${clone.id}/status`, { cache: "no-store" }).catch(() => null)
        )
      ).then(() => void refresh());
    }, 4000);
    return () => window.clearInterval(interval);
  }, [clones, refresh]);

  async function startRecording() {
    setError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mime = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        setBlob(finalBlob);
        setPreviewUrl(URL.createObjectURL(finalBlob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBlob(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadClone() {
    if (!blob) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("wav") ? "wav" : "webm";
      form.append("file", blob, `voice-reference.${ext}`);
      form.append("displayName", displayName);
      form.append("transcript", CONSENT_PHRASE);
      const response = await fetch(`${APP_BASE}/api/voice-clones`, { method: "POST", body: form });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Voice clone failed.");
      setBlob(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function previewVoice(voiceId: string) {
    setError("");
    setPreviewBusyVoiceId(voiceId);
    try {
      const response = await fetch(`${APP_BASE}/api/voices/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, text: VOICE_PREVIEW_TEXT })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Preview failed.");
      }
      const blob = await response.blob();
      if (ttsPreviewUrlRef.current) {
        URL.revokeObjectURL(ttsPreviewUrlRef.current);
        ttsPreviewUrlRef.current = null;
      }
      const url = URL.createObjectURL(blob);
      ttsPreviewUrlRef.current = url;
      setTtsPreviewUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPreviewBusyVoiceId(null);
    }
  }

  async function removeClone(clone: VoiceClone) {
    if (
      !window.confirm(
        `Delete “${clone.displayName}”? It will be removed from your account (and from Mosi when the API allows). This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingCloneId(clone.id);
    setError("");
    try {
      const response = await fetch(`${APP_BASE}/api/voice-clones/${clone.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        remoteDeletionWarning?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Delete failed.");
      if (data.remoteDeletionWarning) {
        setError(
          `Removed from your account. Remote cleanup may have failed: ${data.remoteDeletionWarning}`
        );
      }
      await refresh();
      await syncDefaultFromServer();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingCloneId(null);
    }
  }

  async function setAsDefault(voiceId: string) {
    setBusy(true);
    setError("");
    try {
      const provider = voiceId.startsWith("mosi:") ? "mosi" : "kokoro";
      const response = await fetch(`${APP_BASE}/api/creators/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttsProvider: provider, ttsVoiceId: voiceId })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Failed to save default voice.");
      setDefaultVoiceId(voiceId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark">
            <span>My Voice</span>
            <Link className="raid-stamp" href="/dashboard">dashboard</Link>
          </p>
          <h1>Narration voice</h1>
          <p className="lede">
            Pick a stock voice for your text updates, or {mosiAvailable ? "clone your own with a 30–60 s reference clip." : "stay on a free Kokoro voice."}
          </p>
          <p className="muted">Current default: <strong>{defaultVoiceId}</strong></p>
        </div>
      </section>

      <section className="workspace dashboard-stations">
        <div className="composer">
          <h2>Stock voices</h2>
          <p className="muted">Preview speaks a short sample line; nothing is saved to your station.</p>
          {ttsPreviewUrl ? (
            <div className="recorder-controls voice-tts-preview">
              <audio
                key={ttsPreviewUrl}
                ref={ttsPreviewAudioRef}
                controls
                playsInline
                preload="auto"
                src={ttsPreviewUrl}
                onError={() =>
                  setError("Preview audio failed to load. Re-generate or check Mosi / network.")
                }
              />
            </div>
          ) : null}
          <ul className="voice-grid">
            {voices.map((voice) => (
              <li key={voice.id}>
                <span>{voice.label}</span>
                <small className="muted">{voice.id}</small>
                <div className="voice-card-actions">
                  <button
                    onClick={() => void previewVoice(voice.id)}
                    disabled={busy || Boolean(previewBusyVoiceId)}
                    type="button"
                  >
                    {previewBusyVoiceId === voice.id ? "Loading…" : "Preview"}
                  </button>
                  <button
                    onClick={() => void setAsDefault(voice.id)}
                    disabled={busy || defaultVoiceId === voice.id}
                    type="button"
                  >
                    {defaultVoiceId === voice.id ? "Default" : "Use"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {mosiAvailable ? (
            <>
              <h2>Clone your voice</h2>
              <p className="muted">
                Read this exact phrase out loud to consent to using your voice on this station:
              </p>
              <blockquote className="consent">{CONSENT_PHRASE}</blockquote>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Voice display name"
                type="text"
              />
              <div className="recorder-controls">
                {recording ? (
                  <button onClick={stopRecording} type="button">Stop recording</button>
                ) : (
                  <button onClick={startRecording} disabled={busy} type="button">Record reference</button>
                )}
                <span className="muted">— or —</span>
                <input type="file" accept="audio/*" onChange={pickFile} disabled={busy} />
              </div>
              {previewUrl ? (
                <div className="recorder-controls">
                  <audio controls src={previewUrl} />
                  <button onClick={uploadClone} disabled={busy} type="button">
                    {busy ? "Cloning…" : "Submit clone"}
                  </button>
                </div>
              ) : null}

              <h2>Your voice clones</h2>
              {clones.length === 0 ? (
                <p className="muted">No clones yet.</p>
              ) : (
                <ul className="voice-grid">
                  {clones.map((clone) => {
                    const voiceId = `mosi:${clone.externalVoiceId}`;
                    return (
                      <li key={clone.id}>
                        <span>{clone.displayName}</span>
                        <small className="muted">{clone.status}</small>
                        <div className="voice-card-actions">
                          <button
                            onClick={() => void previewVoice(voiceId)}
                            disabled={
                              busy ||
                              Boolean(previewBusyVoiceId) ||
                              deletingCloneId === clone.id ||
                              clone.status !== "ACTIVE"
                            }
                            type="button"
                          >
                            {previewBusyVoiceId === voiceId ? "Loading…" : "Preview"}
                          </button>
                          <button
                            onClick={() => void setAsDefault(voiceId)}
                            disabled={
                              busy ||
                              Boolean(previewBusyVoiceId) ||
                              deletingCloneId === clone.id ||
                              clone.status !== "ACTIVE" ||
                              defaultVoiceId === voiceId
                            }
                            type="button"
                          >
                            {defaultVoiceId === voiceId ? "Default" : clone.status === "ACTIVE" ? "Use" : "Pending…"}
                          </button>
                          <button
                            className="voice-delete"
                            onClick={() => void removeClone(clone)}
                            disabled={busy || Boolean(previewBusyVoiceId) || deletingCloneId === clone.id}
                            type="button"
                          >
                            {deletingCloneId === clone.id ? "Removing…" : "Delete"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="muted">
              Voice cloning is disabled — set <code>MOSI_API_KEY</code> in your environment to enable it.
            </p>
          )}

          {error ? <p className="signin-error">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
