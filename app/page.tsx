import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MixtapeApp from "./mixtape-app";
import MixtapeHome from "./components/MixtapeHome";
import { getCurrentCreator } from "../lib/auth";
import { appAbsoluteUrl } from "../lib/seo";
import { mixtapeAdminToken } from "../lib/mixtape-write";
import { listMixMoments, listMixes, listSongs, seedMixes, seedMixMoments } from "../lib/mixtapes";
import { getCreator, listStations } from "../lib/stations";

export function generateMetadata(): Metadata {
  return {
    alternates: {
      canonical: appAbsoluteUrl()
    }
  };
}

type HomePageProps = {
  searchParams?: Promise<{ mix?: string; view?: string; song?: string; page?: string; creator?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  await seedMixes();
  await seedMixMoments();
  const params = searchParams ? await searchParams : undefined;
  const initialSelectedId = params?.mix ? Number(params.mix) : null;
  const creator = await getCurrentCreator();

  if (params?.view !== "broadcast" && params?.view !== "studio" && !params?.song) {
    const [mixes, stations, profile] = await Promise.all([
      listMixes("", { publicOnly: !creator, viewerCreatorId: creator?.id ?? null }),
      listStations({ publicOnly: true }),
      params?.page === "profile" && Number.isSafeInteger(Number(params.creator)) && Number(params.creator) > 0
        ? getCreator(Number(params.creator)) : null
    ]);
    if (params?.mix && !mixes.some((mix) => mix.id === Number(params.mix))) notFound();
    return <MixtapeHome initialMixes={mixes} initialStations={stations} allowUnownedEditing={!mixtapeAdminToken()}
      initialCreator={creator ? { id: creator.id, walletAddress: creator.walletAddress, displayName: creator.displayName, avatarUrl: creator.avatarUrl, bio: creator.bio, meTokenAddress: creator.meTokenAddress } : null}
      profileCreator={profile ? { id: profile.id, displayName: profile.displayName, avatarUrl: profile.avatarUrl, bio: profile.bio } : null}/>;
  }

  return (
    <MixtapeApp
      initialMixes={await listMixes("", {
        publicOnly: !creator,
        viewerCreatorId: creator?.id ?? null
      })}
      initialMoments={await listMixMoments(12)}
      initialSongs={await listSongs("", 8)}
      initialStations={await listStations({ publicOnly: true })}
      initialSelectedId={Number.isFinite(initialSelectedId) ? initialSelectedId : null}
      initialCreator={
        creator
          ? {
              id: creator.id,
              walletAddress: creator.walletAddress,
              displayName: creator.displayName
            }
          : null
      }
    />
  );
}
