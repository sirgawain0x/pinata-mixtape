import { createMixMoment, listMixMoments, seedMixes, seedMixMoments } from "../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await seedMixes();
  await seedMixMoments();
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 25);
  return Response.json({ moments: await listMixMoments(limit) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  const moment = await createMixMoment(body);
  return Response.json({ moment }, { status: 201 });
}
