"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SignInButton from "../components/SignInButton";

type Creator = {
  id: number;
  walletAddress: string;
  displayName: string;
};

type Station = {
  id: number;
  handle: string;
  name: string;
  tagline: string;
};

const APP_BASE = "/app";

export default function DashboardClient({
  creator,
  initialStations
}: {
  creator: Creator;
  initialStations: Station[];
}) {
  const router = useRouter();
  const [stations, setStations] = useState(initialStations);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch(`${APP_BASE}/api/stations?mine=1`, { cache: "no-store" });
    const data = (await response.json()) as { stations: Station[] };
    setStations(data.stations);
  }

  async function create() {
    if (!handle.trim() || !name.trim()) {
      setError("Handle and name are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${APP_BASE}/api/stations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, name, tagline })
      });
      const data = (await response.json()) as { station?: Station; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not create station.");
      if (!data.station) throw new Error("Could not open the new station.");
      setHandle("");
      setName("");
      setTagline("");
      router.push(`/s/${data.station.handle}`);
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
            <span>Influencer Radio</span>
            <Link className="raid-stamp" href="/">crate</Link>
          </p>
          <h1>{creator.displayName || "Creator dashboard"}</h1>
          <p className="lede">Programs you host. Add segments and listeners hear them at your station&apos;s public URL.</p>
          <SignInButton />
        </div>
        <div className="deck-card">
          <p className="eyebrow">New station</p>
          <input
            value={handle}
            placeholder="handle (e.g. alice-radio)"
            onChange={(event) => setHandle(event.target.value)}
            type="text"
          />
          <input
            value={name}
            placeholder="Station name"
            onChange={(event) => setName(event.target.value)}
            type="text"
          />
          <input
            value={tagline}
            placeholder="Tagline (optional)"
            onChange={(event) => setTagline(event.target.value)}
            type="text"
          />
          <button onClick={create} disabled={busy} type="button">
            {busy ? "Creating…" : "Create station"}
          </button>
          {error ? <p className="signin-error">{error}</p> : null}
        </div>
      </section>

      <section className="workspace dashboard-stations">
        <h2>Your stations</h2>
        {stations.length === 0 ? (
          <p className="muted">No stations yet — create one above.</p>
        ) : (
          <ul className="station-grid">
            {stations.map((station) => (
              <li key={station.id} className="station-card">
                <h3>{station.name}</h3>
                <p>@{station.handle}</p>
                {station.tagline ? <p className="muted">{station.tagline}</p> : null}
                <div className="station-card-actions">
                  <Link className="button" href={`/dashboard/stations/${station.id}`}>Edit</Link>
                  <Link className="button" href={`/s/${station.handle}`}>Listen</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
