import Link from "next/link";
import { headers } from "next/headers";
import StationPlayer from "../../components/StationPlayer";
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
  const embedOrigin = await requestOrigin();
  const station = getStationByHandle(handle);

  if (!station || !station.isPublic) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Station not found</h1>
            <p>
              <Link className="button" href="/">Browse stations</Link>
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
      durationSeconds: segment.durationSeconds,
      song: song ? { title: song.title, artist: song.artist, youtubeUrl: song.youtubeUrl } : null
    };
  });

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark"><span>Influencer Radio</span></p>
          <h1>{station.name}</h1>
          <p className="lede">@{station.handle}{station.tagline ? ` · ${station.tagline}` : ""}</p>
          <p className="muted">{segments.length} segments programmed</p>
        </div>
      </section>

      <section className="workspace dashboard-stations">
        <StationPlayer stationName={station.name} segments={segments} embedOrigin={embedOrigin} />
      </section>
    </main>
  );
}
