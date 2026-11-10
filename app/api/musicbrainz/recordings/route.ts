import { findRecordingListeningLink } from "../../../../lib/recording-discovery";
import { searchMusicBrainzRecordings } from "../../../../lib/musicbrainz";
import { clientLimiterKey, rateLimitHit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const key = clientLimiterKey(request, "musicbrainz");
  if (!rateLimitHit(key, 20, 60_000)) {
    return Response.json({ error: "MusicBrainz rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const url = new URL(request.url);
  const recordingId = url.searchParams.get("recordingId");
  if (recordingId || url.searchParams.get("findLink") === "1") {
    const listenUrl = await findRecordingListeningLink({
      musicbrainzId: recordingId ?? undefined,
      title: (url.searchParams.get("title") ?? "").slice(0, 160),
      artist: (url.searchParams.get("artist") ?? "").slice(0, 120),
      albumTitle: (url.searchParams.get("album") ?? "").slice(0, 160)
    }, request.signal).catch(() => undefined);
    return Response.json({ listenUrl: listenUrl ?? null });
  }
  const title = url.searchParams.get("title") ?? "";
  const artist = url.searchParams.get("artist") ?? "";
  const query = url.searchParams.get("query") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 5);

  if (!query.trim() && !title.trim() && !artist.trim()) {
    return Response.json(
      { error: "Provide a query, title, or artist for MusicBrainz lookup." },
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
