import { getCurrentCreator } from "../../../../lib/auth";
import { canViewMix } from "../../../../lib/mixtape-access";
import { authorizeMixtapeRequest, canMutateMix } from "../../../../lib/mixtape-write";
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

  const creator = await getCurrentCreator();
  if (!canViewMix(mix, creator?.id ?? null)) {
    return Response.json({ error: "Mix not found." }, { status: 404 });
  }

  return Response.json({ mix });
}

export async function PATCH(request: Request, context: Context) {
  try {
    const ctx = await authorizeMixtapeRequest(request);
    const id = await mixId(context);
    const current = await getMix(id);
    if (!current) return Response.json({ error: "Mix not found." }, { status: 404 });
    if (!canMutateMix(current, ctx)) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const mix = await updateMix(id, body ?? {});
    return Response.json({ mix });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update mix." },
      { status }
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const ctx = await authorizeMixtapeRequest(request);
    const id = await mixId(context);
    const current = await getMix(id);
    if (!current) return Response.json({ error: "Mix not found." }, { status: 404 });
    if (!canMutateMix(current, ctx)) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const deleted = await deleteMix(id);
    if (!deleted) return Response.json({ error: "Mix not found." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not delete mix." },
      { status }
    );
  }
}
