import { withCreator } from "../../../lib/auth";
import { createMosiVoiceClone, isMosiConfigured, uploadMosiReference } from "../../../lib/tts/mosi";
import { isPinataConfigured, uploadFile } from "../../../lib/pinata";
import { createVoiceClone, listVoiceClones } from "../../../lib/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET() {
  return withCreator(async (creator) => {
    return Response.json({ voiceClones: listVoiceClones(creator.id) });
  });
}

export async function POST(request: Request) {
  return withCreator(async (creator) => {
    if (!isMosiConfigured()) {
      return Response.json({ error: "MOSI_API_KEY not configured." }, { status: 503 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ error: "Multipart body required." }, { status: 400 });

    const file = form.get("file");
    const displayName = String(form.get("displayName") ?? `${creator.displayName || creator.walletAddress.slice(0, 8)} voice`);
    const consentText = String(form.get("transcript") ?? "");

    if (!(file instanceof Blob)) {
      return Response.json({ error: "file is required." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Reference exceeds 25 MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let sourceCid = "";
    if (isPinataConfigured()) {
      try {
        const upload = await uploadFile(buffer, {
          name: (file as File).name || `voice-reference-${Date.now()}.wav`,
          mimeType: file.type || "audio/wav"
        });
        sourceCid = upload.cid;
      } catch {
        // non-fatal: still send to Mosi
      }
    }

    try {
      const referenceBlob = new Blob([buffer], { type: file.type || "audio/wav" });
      const upload = await uploadMosiReference(referenceBlob, (file as File).name || "voice.wav");
      const clone = await createMosiVoiceClone({
        fileId: upload.fileId,
        text: consentText || undefined
      });
      const stored = createVoiceClone({
        creatorId: creator.id,
        provider: "mosi",
        externalVoiceId: clone.voiceId,
        displayName,
        sourceCid,
        status: clone.status
      });
      return Response.json({ voiceClone: stored }, { status: 201 });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 502 });
    }
  });
}
