import { authorizeMixtapeRequest, canMutateMix } from "../../../../../../lib/mixtape-write";
import { getMix, removeSongFromMix } from "../../../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; position: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const ctx = await authorizeMixtapeRequest(request);
    const params = await context.params;
    const mixId = Number(params.id);
    const position = Number(params.position);
    if (!Number.isFinite(mixId) || !Number.isFinite(position)) {
      return Response.json({ error: "Invalid mix or position." }, { status: 400 });
    }

    const mix = await getMix(mixId);
    if (!mix) return Response.json({ error: "Mix not found." }, { status: 404 });
    if (!canMutateMix(mix, ctx)) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const updated = await removeSongFromMix(mixId, position);
    return Response.json({ mix: updated });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not remove track." },
      { status }
    );
  }
}
