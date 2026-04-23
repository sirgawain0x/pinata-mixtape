import { enrichSongFromMusicBrainz } from "../../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function songId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

export async function POST(request: Request, context: Context) {
  const body = await request.json().catch(() => ({}));

  try {
    const song = await enrichSongFromMusicBrainz(await songId(context), {
      musicbrainzId: typeof body?.musicbrainzId === "string" ? body.musicbrainzId : "",
      musicbrainzUrl: typeof body?.musicbrainzUrl === "string" ? body.musicbrainzUrl : "",
      youtubeUrl: typeof body?.youtubeUrl === "string" ? body.youtubeUrl : "",
      title: typeof body?.title === "string" ? body.title : "",
      artist: typeof body?.artist === "string" ? body.artist : "",
      releaseYear: typeof body?.releaseYear === "string" ? body.releaseYear : ""
    });

    if (!song) {
      return Response.json({ error: "Song not found." }, { status: 404 });
    }

    return Response.json({ song });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Song enrichment failed." },
      { status: 502 }
    );
  }
}
