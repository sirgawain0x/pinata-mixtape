"use client";

import { useEffect, useState } from "react";

const APP_BASE = "/app";

type MixOption = { id: number; title: string };

type Props = {
  stationId: number;
  onImported: () => void;
};

export default function ImportMixPanel({ stationId, onImported }: Props) {
  const [mixes, setMixes] = useState<MixOption[]>([]);
  const [mixId, setMixId] = useState<number | "">("");
  const [clearExisting, setClearExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`${APP_BASE}/api/mixes?all=1`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { mixes: MixOption[] }) => {
        if (!cancelled) setMixes(data.mixes ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function importMix() {
    if (mixId === "") {
      setError("Choose a mixtape to import.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`${APP_BASE}/api/stations/${stationId}/segments/import-mix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mixId, clearExisting })
      });
      const data = (await response.json()) as { error?: string; mixTitle?: string; segments?: unknown[] };
      if (!response.ok) throw new Error(data.error ?? "Import failed.");
      setStatus(`Imported “${data.mixTitle ?? "mix"}” (${data.segments?.length ?? 0} segments).`);
      onImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-mix-panel composer-form">
      <p className="eyebrow">Import mixtape</p>
      <p className="muted">Pull tracks from a saved mix into this station&apos;s programming.</p>
      <select onChange={(event) => setMixId(event.target.value ? Number(event.target.value) : "")} value={mixId}>
        <option value="">Select a mix…</option>
        {mixes.map((mix) => (
          <option key={mix.id} value={mix.id}>
            {mix.title}
          </option>
        ))}
      </select>
      <label>
        <input checked={clearExisting} onChange={(event) => setClearExisting(event.target.checked)} type="checkbox" /> Replace
        existing segments
      </label>
      <button disabled={busy} onClick={() => void importMix()} type="button">
        {busy ? "Importing…" : "Import mix"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="signin-error">{error}</p> : null}
    </div>
  );
}
