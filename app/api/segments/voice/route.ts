import { withCreator } from "../../../../lib/auth";
import { isPinataConfigured, uploadFile } from "../../../../lib/pinata";
import { addSegment, getStation } from "../../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  return withCreator(async (creator) => {
    if (!isPinataConfigured()) {
      return Response.json({ error: "PINATA_JWT not configured." }, { status: 503 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ error: "Multipart body required." }, { status: 400 });

    const file = form.get("file");
    const stationIdRaw = form.get("stationId");
    const title = String(form.get("title") ?? "Voice update");
    const kindRaw = String(form.get("kind") ?? "voice");
    const kind = kindRaw === "upload" ? "upload" : "voice";

    if (!(file instanceof Blob)) {
      return Response.json({ error: "file is required." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "File exceeds 50 MB limit." }, { status: 413 });
    }

    const stationId = Number(stationIdRaw);
    const station = getStation(stationId);
    if (!station) return Response.json({ error: "Station not found." }, { status: 404 });
    if (station.creatorId !== creator.id) return Response.json({ error: "Forbidden." }, { status: 403 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await uploadFile(buffer, {
      name: (file as File).name || `${kind}-${Date.now()}`,
      mimeType: file.type || "audio/webm"
    });

    const segment = addSegment({
      stationId,
      kind,
      title,
      audioCid: upload.cid,
      audioUrl: upload.url
    });

    return Response.json({ segment, cid: upload.cid, url: upload.url }, { status: 201 });
  });
}
