import { createSong, listSongs, seedMixes } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await seedMixes();
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 12);
  return Response.json({ songs: await listSongs(url.searchParams.get("q") ?? "", limit) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() : "";

  if (!title || !artist) {
    return Response.json({ error: "Song creation requires `title` and `artist`." }, { status: 400 });
  }

  const song = await createSong(body);
  return Response.json({ song }, { status: 201 });
}
