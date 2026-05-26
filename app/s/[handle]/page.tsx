import Link from "next/link";
import { headers } from "next/headers";
import StationPlayer from "../../components/StationPlayer";
import { getCurrentCreator } from "../../../lib/auth";
import { getStationByHandle, listStationSegments } from "../../../lib/stations";
import { getSong } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ handle: string }> };

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim();
  if (!host) return "";
  const rawProto = h.get("x-forwarded-proto");
  const proto =
    rawProto
      ?.split(",")[0]
      ?.trim()
      .replace(/\/$/, "") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  if (proto !== "http" && proto !== "https") return "";
  return `${proto}://${host}`;
}

export default async function StationListenPage({ params }: PageProps) {
  const { handle } = await params;
  const [embedOrigin, creator] = await Promise.all([requestOrigin(), getCurrentCreator()]);
  const station = await getStationByHandle(handle);

  if (!station) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Station not found</h1>
            <p className="muted">
              The station <strong>@{handle}</strong> could not be found.
              If you just created it, try visiting your{" "}
              <Link href="/dashboard">dashboard</Link> to access the editor.
            </p>
            <p>
              <Link className="button" href="/">Browse stations</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const isOwner = creator?.id === station.creatorId;

  if (!station.isPublic && !isOwner) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Station not public yet</h1>
            <p className="muted">
              The station <strong>@{handle}</strong> exists but is not public yet.
              The owner can publish it from the station editor.
            </p>
            <p>
              <Link className="button" href="/">Browse stations</Link>
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
        durationSeconds: segment.durationSeconds,
        song: song ? { title: song.title, artist: song.artist, youtubeUrl: song.youtubeUrl } : null
      };
    })
  );

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark"><span>Influencer Radio</span></p>
          <h1>{station.name}</h1>
          <p className="lede">@{station.handle}{station.tagline ? ` · ${station.tagline}` : ""}</p>
          <p className="muted">{segments.length} segment{segments.length !== 1 ? "s" : ""} programmed</p>
          {!station.isPublic && isOwner && (
            <p className="muted">
              This station is not public yet. Listeners cannot find it until you publish it from the{" "}
              <Link href={`/dashboard/stations/${station.id}`}>editor</Link>.
            </p>
          )}
          {isOwner && (
            <p>
              <Link className="button" href={`/dashboard/stations/${station.id}`}>Edit station →</Link>
            </p>
          )}
        </div>
      </section>

      <section className="workspace dashboard-stations">
        <StationPlayer stationName={station.name} segments={segments} embedOrigin={embedOrigin} />
      </section>
    </main>
  );
}
