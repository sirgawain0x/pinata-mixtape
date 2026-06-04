import { parseCreativeTvUrl, resolvePlaybackByAssetId, isCreativeTvConfigured } from "../../../../lib/creative-tv";
import { syncCreativeTvPlaybackForSong } from "../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawUrl = url.searchParams.get("url")?.trim() ?? "";
  const postIdParam = url.searchParams.get("postId")?.trim() ?? "";
  const songIdRaw = url.searchParams.get("songId")?.trim() ?? "";

  const parsed = rawUrl ? parseCreativeTvUrl(rawUrl) : null;
  const postId = postIdParam || parsed?.postId || "";

  if (!postId) {
    return Response.json({ error: "Provide `url` or `postId` for a Creative TV discover link." }, { status: 400 });
  }

  if (!isCreativeTvConfigured()) {
    return Response.json({ error: "Creative TV API is not configured." }, { status: 503 });
  }

  const songId = Number(songIdRaw);
  if (Number.isInteger(songId) && songId > 0) {
    const song = await syncCreativeTvPlaybackForSong(songId);
    if (song?.livepeerPlaybackId) {
      return Response.json({
        playbackId: song.livepeerPlaybackId,
        postId: song.creativeTvPostId,
        discoverUrl: song.creativeTvUrl
      });
    }
  }

  try {
    const playback = await resolvePlaybackByAssetId(postId);
    return Response.json({
      playbackId: playback.playbackId,
      postId: playback.postId,
      discoverUrl: playback.discoverUrl,
      title: playback.title ?? null,
      durationSeconds: playback.durationSeconds ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creative TV resolve failed.";
    const status = message.includes("not found") ? 404 : message.includes("authorization") ? 403 : 502;
    return Response.json({ error: message }, { status });
  }
}
