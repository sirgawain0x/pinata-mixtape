import { createMix, listMixes, seedMixes } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  seedMixes();
  const url = new URL(request.url);
  return Response.json({ mixes: listMixes(url.searchParams.get("q") ?? "") });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  const mix = createMix(body);
  return Response.json({ mix }, { status: 201 });
}
