import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentCreator } from "../../../lib/auth";
import { canViewMix } from "../../../lib/mixtape-access";
import { getMixBySlug } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const mix = await getMixBySlug(slug);
  if (!mix || !mix.isPublic) {
    return { title: "Mixtape not found" };
  }
  return {
    title: `${mix.title} · Pinata Mixtape`,
    description: mix.description || mix.shareNote || `A curated mixtape with ${mix.tracks.length} tracks.`
  };
}

export default async function PublicMixPage({ params }: PageProps) {
  const { slug } = await params;
  const [mix, creator] = await Promise.all([getMixBySlug(slug), getCurrentCreator()]);

  if (!mix || !canViewMix(mix, creator?.id ?? null)) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Mixtape not found</h1>
            <p className="muted">This tape is private or does not exist.</p>
            <Link className="button" href="/">
              Browse tapes
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark">
            <span>Public mixtape</span>
          </p>
          <h1>{mix.title}</h1>
          <p className="lede">{mix.description}</p>
          <p className="muted">
            {[mix.vibe, mix.useCase, mix.djPersona].filter(Boolean).join(" · ")}
          </p>
          <p>
            <Link className="button" href={`/?mix=${mix.id}`}>
              Open in crate →
            </Link>
            <Link className="button secondary-button" href={`/?mix=${mix.id}&view=broadcast`}>
              Broadcast deck
            </Link>
          </p>
        </div>
      </section>

      <section className="workspace">
        <div className="track-grid">
          {mix.tracks.map((track, index) => (
            <article className="track" key={`${track.artist}-${track.title}-${index}`}>
              <div className="track-head">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h4>{track.title}</h4>
                  <p>{track.artist}</p>
                </div>
              </div>
              {track.songId ? (
                <p>
                  <Link href={`/songs/${track.songId}`}>Open player →</Link>
                </p>
              ) : null}
              {track.notes ? <p>{track.notes}</p> : null}
              <div className="link-row">
                {track.youtubeUrl ? (
                  <a href={track.youtubeUrl} rel="noreferrer" target="_blank">
                    Listen
                  </a>
                ) : null}
                {track.listenUrl ? (
                  <a href={track.listenUrl} rel="noreferrer" target="_blank">
                    Search
                  </a>
                ) : null}
                {track.musicbrainzUrl ? (
                  <a href={track.musicbrainzUrl} rel="noreferrer" target="_blank">
                    MusicBrainz
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
