"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  stationId: number;
  onUploaded: () => void;
  hint?: string;
  uploadKind?: "voice" | "upload";
};

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

export default function VoiceRecorder({ stationId, onUploaded, hint, uploadKind = "voice" }: Props) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function start() {
    setError("");
    setBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");

    const mime = pickMimeType();
    if (!mime) {
      setError("Voice recording is not supported on this browser. Try desktop Chrome/Firefox.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mime });
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

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function upload() {
    if (!blob) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      form.append("file", blob, `${uploadKind}-${Date.now()}.${ext}`);
      form.append("stationId", String(stationId));
      form.append("title", title || (uploadKind === "voice" ? "Voice update" : "Audio clip"));
      form.append("kind", uploadKind);

      const response = await fetch("/app/api/segments/voice", { method: "POST", body: form });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setBlob(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setTitle("");
      onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="recorder">
      {hint ? <p className="muted">{hint}</p> : null}
      <input
        aria-label="Title"
        placeholder="Segment title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        type="text"
      />
      <div className="recorder-controls">
        {recording ? (
          <button onClick={stop} type="button">
            Stop recording
          </button>
        ) : (
          <button onClick={start} disabled={busy} type="button">
            Start recording
          </button>
        )}
        {previewUrl ? (
          <>
            <audio controls src={previewUrl} />
            <button onClick={upload} disabled={busy || !blob} type="button">
              {busy ? "Uploading…" : "Upload to station"}
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="signin-error">{error}</p> : null}
    </div>
  );
}
