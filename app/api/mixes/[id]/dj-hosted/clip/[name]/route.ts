import fs from "node:fs";
import path from "node:path";
import { findDjHostedClip } from "../../../../../../../lib/dj-hosted";

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
  const filePath = findDjHostedClip(mixId, name);
  if (!filePath) {
    return Response.json({ error: "Clip not found." }, { status: 404 });
  }

  const buffer = await fs.promises.readFile(filePath);
  return new Response(buffer, {
    headers: {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store"
    }
  });
}
