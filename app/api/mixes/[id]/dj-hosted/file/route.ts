import fs from "node:fs";
import path from "node:path";
import { getDjHostedCompiledAudioTarget } from "../../../../../../lib/dj-hosted";

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
  const id = await mixId(context);
  const mode = new URL(request.url).searchParams.get("mode") === "download" ? "download" : "stream";
  const target = await getDjHostedCompiledAudioTarget(id, mode);

  if (!target) {
    return Response.json({ error: "Compiled broadcast audio is not available for this mix." }, { status: 404 });
  }

  if (target.startsWith("http://") || target.startsWith("https://")) {
    return Response.redirect(target, 302);
  }

  const buffer = await fs.promises.readFile(target);
  const fileName = path.basename(target);

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType(target),
      "Cache-Control": "no-store",
      ...(mode === "download" ? { "Content-Disposition": `attachment; filename="${fileName}"` } : {})
    }
  });
}
