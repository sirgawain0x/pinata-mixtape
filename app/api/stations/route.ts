import { withCreator } from "../../../lib/auth";
import { createStation, getStationByHandle, listStations } from "../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mine = url.searchParams.get("mine") === "1";
  if (mine) {
    return withCreator(async (creator) => {
      return Response.json({ stations: await listStations({ creatorId: creator.id }) });
    });
  }
  return Response.json({ stations: await listStations({ publicOnly: true }) });
}

export async function POST(request: Request) {
  return withCreator(async (creator) => {
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ error: "Body required." }, { status: 400 });
    const handle = typeof body.handle === "string" ? body.handle.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!handle || !name) {
      return Response.json({ error: "Handle and name are required." }, { status: 400 });
    }

    try {
      const station = await createStation({
        creatorId: creator.id,
        handle,
        name,
        tagline: typeof body.tagline === "string" ? body.tagline : undefined,
        coverUrl: typeof body.coverUrl === "string" ? body.coverUrl : undefined,
        seedMixId: typeof body.seedMixId === "number" ? body.seedMixId : null
      });
      return Response.json({ station }, { status: 201 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const isUnique =
        code === "SQLITE_CONSTRAINT_UNIQUE" ||
        (error instanceof Error && /unique|UNIQUE/i.test(error.message));
      if (isUnique) {
        const existing = await getStationByHandle(handle.toLowerCase());
        if (existing && existing.creatorId === creator.id) {
          return Response.json({ station: existing }, { status: 200 });
        }
        return Response.json({ error: "Station handle is already taken." }, { status: 400 });
      }
      return Response.json({ error: (error as Error).message }, { status: 400 });
    }
  });
}
