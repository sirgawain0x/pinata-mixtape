import { searchMusicBrainzRecordings } from "../../../../lib/musicbrainz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title") ?? "";
  const artist = url.searchParams.get("artist") ?? "";
  const query = url.searchParams.get("query") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 5);

  if (!query.trim() && !title.trim()) {
    return Response.json(
      { error: "Provide `query` or at least `title` for MusicBrainz lookup." },
      { status: 400 }
    );
  }

  try {
    const result = await searchMusicBrainzRecordings({
      title,
      artist,
      query,
      limit
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "MusicBrainz lookup failed." },
      { status: 502 }
    );
  }
}
