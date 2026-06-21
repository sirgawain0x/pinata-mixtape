import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SongPlayerShell from "../../components/SongPlayerShell";
import { buildCrateUrl, findTrackIndexInMix } from "../../../lib/mixtape-nav";
import { ensureCreativeTvPlaybackForSong, getMix, getSong } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fromMix?: string; track?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const song = await getSong(Number(id));
  if (!song) return { title: "Song not found" };
  return {
    title: `${song.title} · ${song.artist} · Pinata Mixtape`,
    description: `Listen to ${song.title} by ${song.artist} on the mixtape turntable.`
  };
}

export default async function SongPage({ params, searchParams }: PageProps) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let song = await getSong(id);
  if (!song) notFound();

  song = (await ensureCreativeTvPlaybackForSong(id)) ?? song;

  const query = searchParams ? await searchParams : {};
  const fromMixId = query.fromMix ? Number(query.fromMix) : null;
  const trackParam = query.track != null ? Number(query.track) : null;

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const embedOrigin = host ? `${proto}://${host}` : "";

  const mixLinks = await Promise.all(
    song.mixIds.map(async (mixId) => {
      const mix = await getMix(mixId);
      const trackIndex = mix ? findTrackIndexInMix(mix, id) : -1;
      return {
        id: mixId,
        title: mix?.title ?? `Mix #${mixId}`,
        href: buildCrateUrl({ mixId, trackIndex: trackIndex >= 0 ? trackIndex : null })
      };
    })
  );

  let backMix: { id: number; title: string; trackIndex?: number | null } | undefined;
  if (fromMixId && Number.isInteger(fromMixId)) {
    const mix = await getMix(fromMixId);
    if (mix) {
      backMix = {
        id: mix.id,
        title: mix.title,
        trackIndex: Number.isInteger(trackParam) ? trackParam : findTrackIndexInMix(mix, id)
      };
    }
  }

  return (
    <main className="shell song-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark">
            {song.isCurated ? <span>Official audio</span> : null}
            {song.creativeTvUrl ? <span>Creative TV</span> : null}
          </p>
          <h1>{song.title}</h1>
          <p className="lede">{song.artist}</p>
          <p className="muted">
            {[song.releaseYear, song.duration].filter(Boolean).join(" · ")}
          </p>
          {song.moodTags.length > 0 ? <p className="muted">{song.moodTags.join(" · ")}</p> : null}
        </div>
      </section>

      <SongPlayerShell backMix={backMix} embedOrigin={embedOrigin} song={song} />

      {mixLinks.length > 0 ? (
        <section className="workspace">
          <h3>On mixtapes</h3>
          <ul className="song-mix-list">
            {mixLinks.map((mix) => (
              <li key={mix.id}>
                <Link href={mix.href}>{mix.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
