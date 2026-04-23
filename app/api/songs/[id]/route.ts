import { getSong, updateSong } from "../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function songId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

export async function GET(_request: Request, context: Context) {
  const song = getSong(await songId(context));
  if (!song) return Response.json({ error: "Song not found." }, { status: 404 });
  return Response.json({ song });
}

export async function PATCH(request: Request, context: Context) {
  const body = await request.json().catch(() => null);
  const song = updateSong(await songId(context), body ?? {});
  if (!song) return Response.json({ error: "Song not found." }, { status: 404 });
  return Response.json({ song });
}
