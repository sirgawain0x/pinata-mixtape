import { isAddress, getAddress } from "viem";
import { getCurrentCreator, jsonError, withCreator } from "../../../../lib/auth";
import { updateCreator } from "../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const creator = await getCurrentCreator();
  if (!creator) return jsonError("Authentication required.", 401);
  return Response.json({ creator });
}

export async function PATCH(request: Request) {
  return withCreator(async (creator) => {
    const body = await request.json().catch(() => null);
    let meTokenAddress: string | null | undefined = undefined;
    if (body && "meTokenAddress" in body) {
      if (body.meTokenAddress === null || body.meTokenAddress === "") {
        meTokenAddress = null;
      } else if (typeof body.meTokenAddress === "string" && isAddress(body.meTokenAddress)) {
        meTokenAddress = getAddress(body.meTokenAddress);
      } else {
        return jsonError("meTokenAddress must be a valid Ethereum address.", 400);
      }
    }

    const next = await updateCreator(creator.id, {
      displayName: typeof body?.displayName === "string" ? body.displayName : undefined,
      avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl : undefined,
      bio: typeof body?.bio === "string" ? body.bio : undefined,
      ttsProvider: typeof body?.ttsProvider === "string" ? body.ttsProvider : undefined,
      ttsVoiceId: typeof body?.ttsVoiceId === "string" ? body.ttsVoiceId : undefined,
      meTokenAddress
    });
    return Response.json({ creator: next });
  });
}
