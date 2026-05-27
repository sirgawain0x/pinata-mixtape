import { getMix, listMixMoments, listMixes, listSongs } from "../../../../lib/mixtapes";
import { clientLimiterKey, rateLimitHit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SuggestionBody = {
  mixId?: number;
  intent?: "curate" | "news" | "broadcast";
  limit?: number;
};

export async function POST(request: Request) {
  try {
    const key = clientLimiterKey(request, "agent-suggestions");
    if (!rateLimitHit(key, 30, 60_000)) {
      return Response.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
    }

    const body = (await request.json().catch(() => null)) as SuggestionBody | null;
    const intent = body?.intent ?? "curate";
    const limit = Math.min(Math.max(body?.limit ?? 8, 1), 20);

    if (intent === "news" && typeof body?.mixId === "number") {
      const mix = await getMix(body.mixId);
      if (!mix) return Response.json({ error: "Mix not found." }, { status: 404 });

      const artists = [...new Set(mix.tracks.map((track) => track.artist).filter(Boolean))].slice(0, 6);
      const timelineDraft = {
        title: `Fresh notes for ${mix.title}`,
        body: `Research recent releases, tours, or press for: ${artists.join(", ")}. Post summaries as timeline moments with mixId ${mix.id}.`,
        kind: "discovery" as const,
        mixId: mix.id
      };

      return Response.json({
        intent,
        mix: { id: mix.id, title: mix.title, slug: mix.slug },
        artists,
        timelineDraft,
        searchHints: artists.map((artist) => `${artist} new music 2026`)
      });
    }

    if (intent === "broadcast" && typeof body?.mixId === "number") {
      const mix = await getMix(body.mixId);
      if (!mix) return Response.json({ error: "Mix not found." }, { status: 404 });

      return Response.json({
        intent,
        mix: { id: mix.id, title: mix.title, trackCount: mix.tracks.length },
        stationImport: {
          endpoint: "POST /app/api/stations/:stationId/segments/import-mix",
          body: { mixId: mix.id, clearExisting: false }
        },
        segmentIdeas: [
          { kind: "voice", hint: "Record a 15s intro before the first track." },
          { kind: "text", hint: "TTS bridge between track 2 and 3 with the DJ persona tone." }
        ]
      });
    }

    const mixes = await listMixes("", { limit });
    const songs = await listSongs("", limit);
    const moments = await listMixMoments(6);

    const energyCounts = new Map<string, number>();
    for (const mix of mixes) {
      for (const track of mix.tracks) {
        if (track.energy) energyCounts.set(track.energy, (energyCounts.get(track.energy) ?? 0) + 1);
      }
    }

    const topEnergy = [...energyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "glow";

    return Response.json({
      intent: "curate",
      library: {
        mixCount: mixes.length,
        songCount: songs.length,
        recentMoments: moments.map((moment) => ({
          title: moment.title,
          kind: moment.kind,
          mixId: moment.mixId
        }))
      },
      suggestions: {
        addTracks: songs.slice(0, 3).map((song) => ({
          title: song.title,
          artist: song.artist,
          musicbrainzUrl: song.musicbrainzUrl,
          reason: "Already in your library — strong reuse candidate."
        })),
        arcNote: `Your recent tapes lean toward "${topEnergy}" energy. Consider one contrast track before the peak.`,
        nextSteps: [
          "Run MusicBrainz lookup for any track missing a canonical recording id.",
          "Attach a direct YouTube URL per track for broadcast playback.",
          "Publish the mix (isPublic) and share /app/m/{slug}."
        ]
      }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
