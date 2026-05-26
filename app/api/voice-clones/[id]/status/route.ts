import { withCreator } from "../../../../../lib/auth";
import { getMosiVoiceStatus } from "../../../../../lib/tts/mosi";
import { getVoiceClone, updateVoiceCloneStatus } from "../../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return withCreator(async (creator) => {
    const params = await context.params;
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid id." }, { status: 400 });

    const clone = await getVoiceClone(id);
    if (!clone) return Response.json({ error: "Not found." }, { status: 404 });
    if (clone.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });

    if (clone.status === "PENDING" && clone.provider === "mosi") {
      try {
        const remote = await getMosiVoiceStatus(clone.externalVoiceId);
        if (remote.status !== clone.status) {
          const next = await updateVoiceCloneStatus(clone.id, remote.status);
          return Response.json({ voiceClone: next });
        }
      } catch {
        // ignore poll errors; return current state
      }
    }

    return Response.json({ voiceClone: clone });
  });
}
