import MixtapeApp from "./mixtape-app";
import { listMixMoments, listMixes, listSongs, seedMixes, seedMixMoments } from "../lib/mixtapes";
import { listStations } from "../lib/stations";

type HomePageProps = {
  searchParams?: Promise<{ mix?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  seedMixes();
  seedMixMoments();
  const params = searchParams ? await searchParams : undefined;
  const initialSelectedId = params?.mix ? Number(params.mix) : null;

  return (
    <MixtapeApp
      initialMixes={listMixes()}
      initialMoments={listMixMoments(12)}
      initialSongs={listSongs("", 8)}
      initialStations={listStations({ publicOnly: true })}
      initialSelectedId={Number.isFinite(initialSelectedId) ? initialSelectedId : null}
    />
  );
}
