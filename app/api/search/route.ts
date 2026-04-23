import { listMixes, listSongs, seedMixes } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  seedMixes();
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  return Response.json({
    mixes: listMixes(q),
    songs: listSongs(q, 10)
  });
}
