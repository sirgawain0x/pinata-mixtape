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
  const station = await getStation(Number(id));

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
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Station not found</h1>
            <p className="muted">
              Station #{id} could not be found. If you just created it, try visiting your{" "}
              <Link href="/dashboard">dashboard</Link> to access the editor.
            </p>
            <p>
              <Link className="button" href="/dashboard">Back to dashboard</Link>
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

  const rawSegments = await listStationSegments(station.id);
  const segments = await Promise.all(
    rawSegments.map(async (segment) => {
      const song = segment.songId ? await getSong(segment.songId) : null;
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
    })
  );

  return <StationEditor station={station} initialSegments={segments} defaultVoiceId={creator.ttsVoiceId} />;
}
