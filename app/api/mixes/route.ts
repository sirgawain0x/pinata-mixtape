import { getCurrentCreator } from "../../../lib/auth";
import { authorizeMixtapeRequest } from "../../../lib/mixtape-write";
import { createMix, listMixes, seedMixes, type MixListFilter } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await seedMixes();
  const url = new URL(request.url);
  const creator = await getCurrentCreator();
  const showMine = url.searchParams.get("mine") === "1" && Boolean(creator);
  const showAll = url.searchParams.get("all") === "1" && Boolean(creator);
  const filter: MixListFilter = showMine
    ? { ownerCreatorId: creator!.id }
    : showAll
      ? {}
      : {
          publicOnly: !creator,
          viewerCreatorId: creator?.id ?? null
        };
  return Response.json({ mixes: await listMixes(url.searchParams.get("q") ?? "", filter) });
}

export async function POST(request: Request) {
  try {
    const ctx = await authorizeMixtapeRequest(request);
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!title) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }

    const creatorId = ctx.viewerCreatorId ?? body?.creatorId ?? null;
    const mix = await createMix({
      ...body,
      title,
      creatorId: typeof creatorId === "number" ? creatorId : null
    });
    return Response.json({ mix }, { status: 201 });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create mix." },
      { status }
    );
  }
}
