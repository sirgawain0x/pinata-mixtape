import { authorizeMixtapeRequest, canMutateMix } from "../../../../../lib/mixtape-write";
import { addSongToMix, getMix } from "../../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function mixId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

export async function POST(request: Request, context: Context) {
  try {
    const ctx = await authorizeMixtapeRequest(request);
    const id = await mixId(context);
    const current = await getMix(id);
    if (!current) return Response.json({ error: "Mix not found." }, { status: 404 });
    if (!canMutateMix(current, ctx)) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const mix = await addSongToMix(id, {
      songId: typeof body?.songId === "number" ? body.songId : undefined,
      position: typeof body?.position === "number" ? body.position : undefined,
      song: body?.song && typeof body.song === "object" ? body.song : undefined
    });

    if (!mix) {
      return Response.json({ error: "Mix not found." }, { status: 404 });
    }

    return Response.json({ mix }, { status: 201 });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400;
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not add song to mix." },
      { status: status >= 500 ? 500 : 400 }
    );
  }
}
