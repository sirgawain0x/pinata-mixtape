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
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [displayName, setDisplayName] = useState(`${creator.displayName || creator.walletAddress.slice(0, 8)} voice`);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const refresh = useCallback(async () => {
    const response = await fetch(`${APP_BASE}/api/voice-clones`, { cache: "no-store" });
    const data = (await response.json()) as { voiceClones: VoiceClone[] };
    setClones(data.voiceClones);
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

  async function setAsDefault(voiceId: string) {
    setBusy(true);
    setError("");
    try {
      const provider = voiceId.startsWith("mosi:") ? "mosi" : "kokoro";
      await fetch(`${APP_BASE}/api/creators/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttsProvider: provider, ttsVoiceId: voiceId })
      });
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
          <ul className="voice-grid">
            {voices.map((voice) => (
              <li key={voice.id}>
                <span>{voice.label}</span>
                <small className="muted">{voice.id}</small>
                <button
                  onClick={() => void setAsDefault(voice.id)}
                  disabled={busy || defaultVoiceId === voice.id}
                  type="button"
                >
                  {defaultVoiceId === voice.id ? "Default" : "Use"}
                </button>
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
                        <button
                          onClick={() => void setAsDefault(voiceId)}
                          disabled={busy || clone.status !== "ACTIVE" || defaultVoiceId === voiceId}
                          type="button"
                        >
                          {defaultVoiceId === voiceId ? "Default" : clone.status === "ACTIVE" ? "Use" : "Pending…"}
                        </button>
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
