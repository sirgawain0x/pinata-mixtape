import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SongPlayerShell from "../../components/SongPlayerShell";
import { ensureCreativeTvPlaybackForSong, getSong } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const song = await getSong(Number(id));
  if (!song) return { title: "Song not found" };
  return {
    title: `${song.title} · ${song.artist} · Pinata Mixtape`,
    description: `Listen to ${song.title} by ${song.artist} on the mixtape turntable.`
  };
}

export default async function SongPage({ params }: PageProps) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let song = await getSong(id);
  if (!song) notFound();

  song = (await ensureCreativeTvPlaybackForSong(id)) ?? song;

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const embedOrigin = host ? `${proto}://${host}` : "";

  const mixLinks = song.mixIds.map((mixId) => ({
    id: mixId,
    href: `/?mix=${mixId}`
  }));

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

      <SongPlayerShell embedOrigin={embedOrigin} song={song} />

      {mixLinks.length > 0 ? (
        <section className="workspace">
          <h3>On mixtapes</h3>
          <ul className="song-mix-list">
            {mixLinks.map((mix) => (
              <li key={mix.id}>
                <Link href={mix.href}>Mix #{mix.id}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
