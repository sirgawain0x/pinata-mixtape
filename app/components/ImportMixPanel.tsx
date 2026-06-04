"use client";

import { useEffect, useState } from "react";

const APP_BASE = "/app";

type MixOption = { id: number; title: string; tracks?: unknown[] };

type Props = {
  stationId: number;
  onImported: () => void;
};

export default function ImportMixPanel({ stationId, onImported }: Props) {
  const [mixes, setMixes] = useState<MixOption[]>([]);
  const [mixId, setMixId] = useState<number | "">("");
  const [clearExisting, setClearExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetch(`${APP_BASE}/api/mixes?mine=1`, { cache: "no-store", credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load mixtapes.");
        }
        return response.json();
      })
      .then((data: { mixes: MixOption[] }) => {
        if (!cancelled) setMixes(data.mixes ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load mixtapes.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
      <p className="eyebrow">Import your mixtape</p>
      <p className="muted">Pull tracks from a mixtape you created into this station&apos;s programming.</p>
      {!loading && !error && mixes.length === 0 ? (
        <p className="muted">
          You haven&apos;t created any mixtapes yet. Build one from the <a href="/">crate</a> with “New tape,” then
          come back to import it.
        </p>
      ) : null}
      <select
        disabled={loading || mixes.length === 0}
        onChange={(event) => setMixId(event.target.value ? Number(event.target.value) : "")}
        value={mixId}
      >
        <option value="">{loading ? "Loading your mixtapes…" : "Select a mix…"}</option>
        {mixes.map((mix) => {
          const count = Array.isArray(mix.tracks) ? mix.tracks.length : 0;
          return (
            <option key={mix.id} value={mix.id}>
              {mix.title}
              {count ? ` (${count} track${count === 1 ? "" : "s"})` : ""}
            </option>
          );
        })}
      </select>
      <label>
        <input checked={clearExisting} onChange={(event) => setClearExisting(event.target.checked)} type="checkbox" /> Replace
        existing segments
      </label>
      <button disabled={busy || loading || mixes.length === 0} onClick={() => void importMix()} type="button">
        {busy ? "Importing…" : "Import mix"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="signin-error">{error}</p> : null}
    </div>
  );
}
