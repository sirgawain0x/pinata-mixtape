import { getCreator } from "../../../../lib/stations";
import { jsonError } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const creatorId = Number(id);
  if (!Number.isFinite(creatorId) || creatorId <= 0) {
    return jsonError("Invalid creator id.", 400);
  }
  const creator = await getCreator(creatorId);
  if (!creator) return jsonError("Creator not found.", 404);
  return Response.json({
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      walletAddress: creator.walletAddress,
      meTokenAddress: creator.meTokenAddress,
      avatarUrl: creator.avatarUrl
    }
  });
}
