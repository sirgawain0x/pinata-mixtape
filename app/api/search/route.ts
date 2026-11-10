import { getCurrentCreator } from "../../../lib/auth";
import { listMixes, listSongs, seedMixes } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await seedMixes();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const creator = await getCurrentCreator();
  const [mixes, songs] = await Promise.all([
    listMixes(q, { publicOnly: !creator, viewerCreatorId: creator?.id ?? null }),
    listSongs(q, 10, { publicOnly: !creator, viewerCreatorId: creator?.id ?? null })
  ]);
  return Response.json({
    mixes,
    songs
  });
}
