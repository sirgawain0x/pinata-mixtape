import { withCreator } from "../../../../lib/auth";
import { updateCreator } from "../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  return withCreator(async (creator) => {
    const body = await request.json().catch(() => null);
    const next = await updateCreator(creator.id, {
      displayName: typeof body?.displayName === "string" ? body.displayName : undefined,
      avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl : undefined,
      bio: typeof body?.bio === "string" ? body.bio : undefined,
      ttsProvider: typeof body?.ttsProvider === "string" ? body.ttsProvider : undefined,
      ttsVoiceId: typeof body?.ttsVoiceId === "string" ? body.ttsVoiceId : undefined
    });
    return Response.json({ creator: next });
  });
}
