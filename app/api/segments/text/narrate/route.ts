import { withCreator } from "../../../../../lib/auth";
import { isPinataConfigured, uploadFile } from "../../../../../lib/pinata";
import {
  findGlobalCachedTts,
  getSegment,
  getStation,
  updateSegment
} from "../../../../../lib/stations";
import { normalizeSynthesizedAudio } from "../../../../../lib/audio-binary";
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
      synthesized = normalizeSynthesizedAudio(
        await provider.synthesize(segment.body, { voiceId: resolvedVoiceId })
      );
    } catch {
      return Response.json({ error: "Narration provider failed." }, { status: 502 });
    }

    const normalizedMimeType = synthesized.mimeType.startsWith("audio/")
      ? synthesized.mimeType
      : "audio/mpeg";
    const ext = normalizedMimeType.includes("wav")
      ? "wav"
      : normalizedMimeType.includes("mpeg") || normalizedMimeType.includes("mp3")
        ? "mp3"
        : normalizedMimeType.includes("ogg")
          ? "ogg"
          : "mp3";
    let upload;
    try {
      upload = await uploadFile(synthesized.audio, {
        name: `narration-${segment.id}.${ext}`,
        mimeType: normalizedMimeType
      });
    } catch {
      return Response.json({ error: "Could not store narration audio." }, { status: 502 });
    }

    const updated = updateSegment(segment.id, {
      audioCid: upload.cid,
      audioUrl: upload.url,
      durationSeconds: synthesized.durationSeconds ?? null,
      ttsVoice: resolvedVoiceId,
      ttsProvider: provider.id
    });

    return Response.json({ segment: updated, cached: false });
  });
}
