import { authorizeMixtapeRequest, canMutateMix } from "../../../../../lib/mixtape-write";
import { getMix, reorderMixTracks } from "../../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const ctx = await authorizeMixtapeRequest(request);
    const params = await context.params;
    const mixId = Number(params.id);
    if (!Number.isFinite(mixId)) {
      return Response.json({ error: "Invalid mix id." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const positions = Array.isArray(body?.positions)
      ? body.positions.map((value: unknown) => Number(value)).filter((n: number) => Number.isFinite(n))
      : [];

    const mix = await getMix(mixId);
    if (!mix) return Response.json({ error: "Mix not found." }, { status: 404 });
    if (!canMutateMix(mix, ctx)) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const updated = await reorderMixTracks(mixId, positions);
    return Response.json({ mix: updated });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400;
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not reorder tracks." },
      { status: status >= 500 ? 500 : 400 }
    );
  }
}
