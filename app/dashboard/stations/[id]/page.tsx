import Link from "next/link";
import { getCurrentCreator } from "../../../../lib/auth";
import { getStation, listStationSegments } from "../../../../lib/stations";
import { getSong } from "../../../../lib/mixtapes";
import StationEditor from "./editor";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function StationEditorPage({ params }: PageProps) {
  const creator = await getCurrentCreator();
  const { id } = await params;
  const station = getStation(Number(id));

  if (!creator) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Sign in to edit a station</h1>
            <p>
              <Link className="button" href="/dashboard">Go to dashboard</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!station) {
    const onVercel = process.env.VERCEL === "1";
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Station not found</h1>
            {onVercel ? (
              <p className="muted">
                On Vercel this app uses a temporary SQLite file per instance. Creating a station on one
                request and opening it on another often shows nothing here. Use a hosted database (e.g.
                Postgres or Turso) wired into this project for real persistence.
              </p>
            ) : null}
            <p>
              <Link className="button" href="/dashboard">Back</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (station.creatorId !== creator.id) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>You don&apos;t own this station.</h1>
            <p>
              <Link className="button" href="/dashboard">Back</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const rawSegments = listStationSegments(station.id);
  const segments = rawSegments.map((segment) => {
    const song = segment.songId ? getSong(segment.songId) : null;
    return {
      id: segment.id,
      position: segment.position,
      kind: segment.kind,
      title: segment.title,
      body: segment.body,
      audioCid: segment.audioCid,
      audioUrl: segment.audioUrl,
      ttsVoice: segment.ttsVoice,
      ttsProvider: segment.ttsProvider,
      song: song ? { title: song.title, artist: song.artist, youtubeUrl: song.youtubeUrl } : null
    };
  });

  return <StationEditor station={station} initialSegments={segments} defaultVoiceId={creator.ttsVoiceId} />;
}
