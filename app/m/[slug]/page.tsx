import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentCreator } from "../../../lib/auth";
import { canViewMix } from "../../../lib/mixtape-access";
import { appAbsoluteUrl } from "../../../lib/seo";
import MixtapePageFrame from "../../components/MixtapePageFrame";
import PlaylistDetail from "../../components/PlaylistDetail";
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
    title: `${mix.title} · Mixtape`,
    description: mix.description || mix.shareNote || `A curated mixtape with ${mix.tracks.length} tracks.`,
    alternates: {
      canonical: appAbsoluteUrl(`m/${mix.slug}`)
    }
  };
}

export default async function PublicMixPage({ params }: PageProps) {
  const { slug } = await params;
  const [mix, creator] = await Promise.all([getMixBySlug(slug), getCurrentCreator()]);

  if (!mix || !canViewMix(mix, creator?.id ?? null)) {
    return (
      <MixtapePageFrame>
        <section className="mt-empty mt-missing">
          <h1>Mixtape not found</h1>
          <p>This tape is private or does not exist.</p>
          <Link className="mt-primary" href="/">Browse Mixtape</Link>
        </section>
      </MixtapePageFrame>
    );
  }

  return (
    <MixtapePageFrame>
      <PlaylistDetail mix={mix} trackIndex={0} canEdit={false} />
    </MixtapePageFrame>
  );
}
