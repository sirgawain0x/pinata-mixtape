import { withCreator } from "../../../../lib/auth";
import { normalizeSynthesizedAudio } from "../../../../lib/audio-binary";
import { resolveProvider } from "../../../../lib/tts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PREVIEW_CHARS = 400;
const DEFAULT_TEXT = "Hello — this is a quick preview of this voice for your radio station.";

export async function POST(request: Request) {
  return withCreator(async () => {
    const body = await request.json().catch(() => null);
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId.trim() : "";
    let text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!voiceId) return Response.json({ error: "voiceId is required." }, { status: 400 });
    if (!text) text = DEFAULT_TEXT;
    if (text.length > MAX_PREVIEW_CHARS) {
      return Response.json(
        { error: `Preview text must be at most ${MAX_PREVIEW_CHARS} characters.` },
        { status: 400 }
      );
    }

    const provider = resolveProvider(voiceId);
    let synthesized;
    try {
      synthesized = normalizeSynthesizedAudio(await provider.synthesize(text, { voiceId }));
    } catch (error) {
      console.error("Voice preview failed", error);
      return Response.json({ error: "Voice preview failed." }, { status: 502 });
    }

    return new Response(new Uint8Array(synthesized.audio), {
      headers: {
        "Content-Type": synthesized.mimeType,
        "Cache-Control": "no-store"
      }
    });
  });
}
