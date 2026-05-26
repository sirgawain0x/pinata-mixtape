import { listMixes, listSongs, seedMixes } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await seedMixes();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  return Response.json({
    mixes: await listMixes(q),
    songs: await listSongs(q, 10)
  });
}
