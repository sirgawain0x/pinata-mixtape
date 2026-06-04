import { authorizeMixtapeRequest } from "../../../../../lib/mixtape-write";
import { isPinataConfigured, uploadFile } from "../../../../../lib/pinata";
import { getSong, setSongAdminAudio } from "../../../../../lib/mixtapes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024;

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  const ctx = await authorizeMixtapeRequest(request);
  if (ctx.kind !== "trusted" || !ctx.isAdminToken) {
    return Response.json({ error: "Admin token required for song audio upload." }, { status: 403 });
  }

  if (!isPinataConfigured()) {
    return Response.json({ error: "PINATA_JWT not configured." }, { status: 503 });
  }

  const params = await context.params;
  const songId = Number(params.id);
  if (!Number.isInteger(songId) || songId <= 0) {
    return Response.json({ error: "Invalid song id." }, { status: 400 });
  }

  const existing = await getSong(songId);
  if (!existing) {
    return Response.json({ error: "Song not found." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Multipart body required." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "file is required." }, { status: 400 });
  }
  if (!file.type.startsWith("audio/")) {
    return Response.json({ error: "Only audio uploads are supported." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File exceeds 50 MB limit." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const upload = await uploadFile(buffer, {
    name: (file as File).name || `song-${songId}-${Date.now()}`,
    mimeType: file.type || "audio/mpeg"
  });

  const song = await setSongAdminAudio(songId, {
    audioCid: upload.cid,
    audioUrl: upload.url,
    durationSeconds: existing.durationSeconds
  });

  return Response.json({ song });
}
