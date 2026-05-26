import fs from "node:fs";
import path from "node:path";
import { getDjHostedClipTarget } from "../../../../../../../lib/dj-hosted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string; name: string }>;
};

async function clipContext(context: Context): Promise<{ mixId: number; name: string }> {
  const params = await context.params;
  return {
    mixId: Number(params.id),
    name: params.name
  };
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    case ".aac":
      return "audio/aac";
    default:
      return "application/octet-stream";
  }
}

export async function GET(_request: Request, context: Context) {
  const { mixId, name } = await clipContext(context);
  const target = await getDjHostedClipTarget(mixId, name);
  if (!target) {
    return Response.json({ error: "Clip not found." }, { status: 404 });
  }

  if (target.startsWith("http://") || target.startsWith("https://")) {
    return Response.redirect(target, 302);
  }

  const buffer = await fs.promises.readFile(target);
  return new Response(buffer, {
    headers: {
      "Content-Type": contentType(target),
      "Cache-Control": "no-store"
    }
  });
}
