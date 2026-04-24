import { withCreator } from "../../../../../lib/auth";
import { isPinataConfigured, uploadFile } from "../../../../../lib/pinata";
import {
  findGlobalCachedTts,
  getSegment,
  getStation,
  updateSegment
} from "../../../../../lib/stations";
import { resolveProvider } from "../../../../../lib/tts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withCreator(async (creator) => {
    const body = await request.json().catch(() => null);
    const segmentId = Number(body?.segmentId);
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "";

    const segment = getSegment(segmentId);
    if (!segment) return Response.json({ error: "Segment not found." }, { status: 404 });
    if (segment.kind !== "text") {
      return Response.json({ error: "Only text segments can be narrated." }, { status: 400 });
    }
    if (!segment.body.trim()) {
      return Response.json({ error: "Text body is empty." }, { status: 400 });
    }

    const station = getStation(segment.stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const provider = resolveProvider(voiceId || creator.ttsVoiceId || "kokoro:af_heart");
    const resolvedVoiceId = voiceId || creator.ttsVoiceId || "kokoro:af_heart";

    const cached = findGlobalCachedTts(segment.body, resolvedVoiceId, provider.id);
    if (cached) {
      const updated = updateSegment(segment.id, {
        audioCid: cached.audioCid,
        audioUrl: cached.audioUrl,
        durationSeconds: cached.durationSeconds,
        ttsVoice: resolvedVoiceId,
        ttsProvider: provider.id
      });
      return Response.json({ segment: updated, cached: true });
    }

    if (!isPinataConfigured()) {
      return Response.json({ error: "PINATA_JWT not configured." }, { status: 503 });
    }

    let synthesized;
    try {
      synthesized = await provider.synthesize(segment.body, { voiceId: resolvedVoiceId });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 502 });
    }

    const ext = synthesized.mimeType.includes("wav") ? "wav" : synthesized.mimeType.includes("mpeg") ? "mp3" : "audio";
    const upload = await uploadFile(synthesized.audio, {
      name: `narration-${segment.id}.${ext}`,
      mimeType: synthesized.mimeType
    });

    const updated = updateSegment(segment.id, {
      audioCid: upload.cid,
      audioUrl: upload.url,
      ttsVoice: resolvedVoiceId,
      ttsProvider: provider.id
    });

    return Response.json({ segment: updated, cached: false });
  });
}
