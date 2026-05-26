import MixtapeApp from "./mixtape-app";
import { getCurrentCreator } from "../lib/auth";
import { listMixMoments, listMixes, listSongs, seedMixes, seedMixMoments } from "../lib/mixtapes";
import { listStations } from "../lib/stations";

type HomePageProps = {
  searchParams?: Promise<{ mix?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  await seedMixes();
  await seedMixMoments();
  const params = searchParams ? await searchParams : undefined;
  const initialSelectedId = params?.mix ? Number(params.mix) : null;
  const creator = await getCurrentCreator();

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
    />
  );
}
