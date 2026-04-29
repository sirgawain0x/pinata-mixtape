import { withCreator } from "../../../../lib/auth";
import { deleteMosiVoice, isMosiConfigured } from "../../../../lib/tts/mosi";
import {
  deleteVoiceClone,
  getCreator,
  getVoiceClone,
  updateCreator
} from "../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isFinite(id)) return Response.json({ error: "Invalid id." }, { status: 400 });

    const clone = getVoiceClone(id);
    if (!clone) return Response.json({ error: "Voice clone not found." }, { status: 404 });
    if (clone.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });

    let remoteDeletionWarning: string | undefined;
    if (clone.provider === "mosi" && isMosiConfigured()) {
      try {
        await deleteMosiVoice(clone.externalVoiceId);
      } catch (error) {
        remoteDeletionWarning = (error as Error).message;
      }
    }

    const fullVoiceId = `${clone.provider}:${clone.externalVoiceId}`;
    const me = getCreator(creator.id);
    if (me?.ttsVoiceId === fullVoiceId) {
      updateCreator(creator.id, { ttsProvider: "kokoro", ttsVoiceId: "kokoro:af_heart" });
    }

    if (!deleteVoiceClone(id, creator.id)) {
      return Response.json({ error: "Could not delete voice clone." }, { status: 500 });
    }

    return Response.json({
      ok: true,
      ...(remoteDeletionWarning ? { remoteDeletionWarning } : {})
    });
  });
}
