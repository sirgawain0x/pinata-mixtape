"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ImportMixPanel from "../../../components/ImportMixPanel";
import SegmentComposer from "../../../components/SegmentComposer";

type Station = {
  id: number;
  handle: string;
  name: string;
  tagline: string;
  isPublic: boolean;
};

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
  song: { title: string; artist: string; youtubeUrl: string } | null;
};

const APP_BASE = "/app";

export default function StationEditor({
  station,
  initialSegments,
  defaultVoiceId
}: {
  station: Station;
  initialSegments: Segment[];
  defaultVoiceId: string;
}) {
  const [segments, setSegments] = useState(initialSegments);
  const [voices, setVoices] = useState<{ id: string; label: string }[]>([]);
  const [chosenVoice, setChosenVoice] = useState(defaultVoiceId);
  const [isPublic, setIsPublic] = useState(station.isPublic);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`${APP_BASE}/api/stations/${station.id}/segments`, { cache: "no-store" });
    const data = (await response.json()) as { segments: Segment[] };
    setSegments(data.segments);
  }, [station.id]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${APP_BASE}/api/voices`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { voices: { id: string; label: string }[]; defaultVoiceId?: string }) => {
        if (cancelled) return;
        setVoices(data.voices);
        if (!chosenVoice && data.defaultVoiceId) setChosenVoice(data.defaultVoiceId);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [chosenVoice]);

  async function togglePublish() {
    setPublishBusy(true);
    setPublishError("");
    try {
      const response = await fetch(`${APP_BASE}/api/stations/${station.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic })
      });
      const data = (await response.json()) as { station?: Station; error?: string };
      if (!response.ok || !data.station) {
        throw new Error(data.error ?? "Could not update station.");
      }
      setIsPublic(data.station.isPublic);
    } catch (err) {
      setPublishError((err as Error).message);
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <main className="shell station-editor">
      <section className="hero hero-single">
        <div className="hero-copy">
          <p className="hero-mark">
            <span>Station editor</span>
            <Link className="raid-stamp" href="/dashboard">dashboard</Link>
          </p>
          <h1>{station.name}</h1>
          <p className="lede">@{station.handle}{station.tagline ? ` · ${station.tagline}` : ""}</p>
          <p className="muted">
            Need a new narration voice? <Link href="/dashboard/voice">Configure it here</Link>.
          </p>
          <div className="hero-actions">
            <Link className="button" href={`/s/${station.handle}`}>
              {isPublic ? "Open public page →" : "Preview station →"}
            </Link>
            <label className="publish-toggle muted">
              <input
                checked={isPublic}
                disabled={publishBusy}
                onChange={() => void togglePublish()}
                type="checkbox"
              />
              <span>
                Public — listeners can open <code>/s/{station.handle}</code> without signing in
              </span>
            </label>
          </div>
          {publishError ? <p className="signin-error">{publishError}</p> : null}
        </div>
      </section>

      <section className="workspace dashboard-stations">
        <ImportMixPanel stationId={station.id} onImported={() => void refresh()} />
        <SegmentComposer
          stationId={station.id}
          segments={segments}
          voices={voices}
          defaultVoiceId={chosenVoice}
          onChange={() => void refresh()}
        />
      </section>
    </main>
  );
}
