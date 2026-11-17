import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MixtapePageFrame from "../../components/MixtapePageFrame";
import { PlaylistArt } from "../../components/MixtapeIcons";
import SongPlayerShell from "../../components/SongPlayerShell";
import { getCurrentCreator } from "../../../lib/auth";
import { canViewMix } from "../../../lib/mixtape-access";
import { buildCrateUrl, findTrackIndexInMix } from "../../../lib/mixtape-nav";
import { appAbsoluteUrl } from "../../../lib/seo";
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
    title: `${song.title} · ${song.artist} · Creative Mixtape`,
    description: `Listen to ${song.title} by ${song.artist} on the mixtape turntable.`,
    alternates: {
      canonical: appAbsoluteUrl(`songs/${id}`)
    }
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

  const [creator, mixes] = await Promise.all([
    getCurrentCreator(),
    Promise.all(song.mixIds.map((mixId) => getMix(mixId)))
  ]);
  const visibleMixes = mixes.filter((mix): mix is NonNullable<typeof mix> =>
    mix !== null && canViewMix(mix, creator?.id ?? null)
  );
  const originMix = visibleMixes.find((mix) => mix.id === fromMixId);
  const backMix = originMix ? {
    id: originMix.id,
    title: originMix.title,
    trackIndex: trackParam !== null && originMix.tracks[trackParam]?.songId === id
      ? trackParam : findTrackIndexInMix(originMix, id)
  } : undefined;
  const releaseDetails = [song.albumTitle, song.releaseDate || song.releaseYear, song.duration].filter(Boolean).join(" · ");

  return (
    <MixtapePageFrame>
      <div className="mt-section-heading">
        <Link href={backMix ? buildCrateUrl({ mixId: backMix.id, trackIndex: backMix.trackIndex }) : "/"}>
          {backMix ? `← Back to ${backMix.title}` : "← Browse Mixtape"}
        </Link>
      </div>
      <div className="mt-album-layout">
        <div className="mt-album-info mt-song-info">
          <div className="mt-album-art"><PlaylistArt title={song.title} id={song.id} /></div>
          <div className="mt-album-copy">
            {song.isCurated ? <p className="mt-kicker">Official audio</p> : null}
            <h1>{song.title}</h1>
            <p>{song.artist}</p>
            {releaseDetails ? <p className="mt-album-description">{releaseDetails}</p> : null}
            {song.moodTags.length ? <p className="mt-album-description">{song.moodTags.join(" · ")}</p> : null}
          </div>
        </div>
        <SongPlayerShell embedOrigin={embedOrigin} song={song} />
      </div>
      {visibleMixes.length ? (
        <section className="mt-section" aria-labelledby="on-mixtapes">
          <div className="mt-section-heading"><h2 id="on-mixtapes">On mixtapes</h2></div>
          <div className="mt-song-grid">
            {visibleMixes.map((mix) => (
              <Link className="mt-song-tile" key={mix.id} href={buildCrateUrl({ mixId: mix.id, trackIndex: findTrackIndexInMix(mix, id) })}>
                <PlaylistArt compact title={mix.title} id={mix.id} />
                <span><strong>{mix.title}</strong><small>{mix.genre || mix.vibe}</small></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </MixtapePageFrame>
  );
}
