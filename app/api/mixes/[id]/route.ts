import { deleteMix, getMix, updateMix } from "../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function mixId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

export async function GET(_request: Request, context: Context) {
  const mix = await getMix(await mixId(context));
  if (!mix) return Response.json({ error: "Mix not found." }, { status: 404 });
  return Response.json({ mix });
}

export async function PATCH(request: Request, context: Context) {
  const body = await request.json().catch(() => null);
  const mix = await updateMix(await mixId(context), body ?? {});
  if (!mix) return Response.json({ error: "Mix not found." }, { status: 404 });
  return Response.json({ mix });
}

export async function DELETE(_request: Request, context: Context) {
  const deleted = await deleteMix(await mixId(context));
  if (!deleted) return Response.json({ error: "Mix not found." }, { status: 404 });
  return Response.json({ ok: true });
}
