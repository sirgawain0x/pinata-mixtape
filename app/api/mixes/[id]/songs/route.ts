import { addSongToMix } from "../../../../../lib/mixtapes";

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
  const body = await request.json().catch(() => null);

  try {
    const mix = await addSongToMix(await mixId(context), {
      songId: typeof body?.songId === "number" ? body.songId : undefined,
      position: typeof body?.position === "number" ? body.position : undefined,
      song: body?.song && typeof body.song === "object" ? body.song : undefined
    });

    if (!mix) {
      return Response.json({ error: "Mix not found." }, { status: 404 });
    }

    return Response.json({ mix }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not add song to mix." },
      { status: 400 }
    );
  }
}
