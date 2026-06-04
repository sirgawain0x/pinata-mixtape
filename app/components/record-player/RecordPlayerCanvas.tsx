"use client";

import dynamic from "next/dynamic";

const RecordPlayerScene = dynamic(() => import("./RecordPlayerScene"), {
  ssr: false,
  loading: () => <div className="record-player-canvas-wrap record-player-loading">Loading turntable…</div>
});

export default RecordPlayerScene;
