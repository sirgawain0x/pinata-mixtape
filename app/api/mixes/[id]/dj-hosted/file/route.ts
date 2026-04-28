import fs from "node:fs";
import path from "node:path";
import { findDjHostedCompiledAudio } from "../../../../../../lib/dj-hosted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

async function mixId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}

export async function GET(request: Request, context: Context) {
  const filePath = findDjHostedCompiledAudio(await mixId(context));
  if (!filePath) {
    return Response.json({ error: "Compiled broadcast audio is not available for this mix." }, { status: 404 });
  }

  const mode = new URL(request.url).searchParams.get("mode");
  const buffer = await fs.promises.readFile(filePath);
  const fileName = path.basename(filePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store",
      ...(mode === "download" ? { "Content-Disposition": `attachment; filename="${fileName}"` } : {})
    }
  });
}
