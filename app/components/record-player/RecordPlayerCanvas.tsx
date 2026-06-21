"use client";

import dynamic from "next/dynamic";

const RecordPlayerScene = dynamic(() => import("./RecordPlayerScene"), {
  ssr: false,
  loading: () => <div className="record-player-canvas-wrap record-player-loading">Loading turntable…</div>
});

type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;
  title: string;
  artist?: string;
};

export default function RecordPlayerCanvas({ isPlaying, onTogglePlay, title, artist }: Props) {
  return <RecordPlayerScene artist={artist} isPlaying={isPlaying} onTogglePlay={onTogglePlay} title={title} />;
}
