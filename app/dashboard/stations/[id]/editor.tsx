"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SegmentComposer from "../../../components/SegmentComposer";

type Station = {
  id: number;
  handle: string;
  name: string;
  tagline: string;
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

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark">
            <span>Station editor</span>
            <Link className="raid-stamp" href="/dashboard">dashboard</Link>
          </p>
          <h1>{station.name}</h1>
          <p className="lede">@{station.handle}{station.tagline ? ` · ${station.tagline}` : ""}</p>
          <p>
            <Link className="button" href={`/s/${station.handle}`}>Open public page →</Link>
          </p>
        </div>
      </section>

      <section className="workspace dashboard-stations">
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
