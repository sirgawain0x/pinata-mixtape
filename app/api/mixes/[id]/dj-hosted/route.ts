import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readDjHostedManifest } from "../../../../../lib/dj-hosted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const generatorScript = path.join(process.cwd(), "workspace", "scripts", "venice_dj_poc.py");

type Context = {
  params: Promise<{ id: string }>;
};

async function mixId(context: Context): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

export async function GET(_request: Request, context: Context) {
  const id = await mixId(context);
  const manifest = readDjHostedManifest(id);
  if (!manifest) {
    return Response.json({ error: "Hosted DJ narrative not found." }, { status: 404 });
  }

  return Response.json({
    result: {
      mixId: manifest.mixId,
      mixTitle: manifest.mixTitle,
      voice: manifest.voice,
      model: manifest.model,
      output: path.join(process.cwd(), "workspace", "data", "generated-mixtapes", `${id}-dj-hosted`, `${id}-dj-hosted-mixtape.mp3`),
      script: path.join(process.cwd(), "workspace", "data", "generated-mixtapes", `${id}-dj-hosted`, "dj-script.json"),
      streamUrl: manifest.streamUrl ?? `/app/api/mixes/${id}/dj-hosted/file?mode=stream`,
      downloadUrl: manifest.downloadUrl ?? `/app/api/mixes/${id}/dj-hosted/file?mode=download`,
      clips: manifest.clips,
      sourceTracks: manifest.sourceTracks,
      segments: manifest.segments
    }
  });
}

export async function POST(request: Request, context: Context) {
  const id = await mixId(context);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: "Invalid mix id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as { voice?: string } | null;
  const voice = body?.voice?.trim();

  if (!fs.existsSync(generatorScript)) {
    return Response.json(
      { error: "DJ narration generation script is not installed in this environment. Existing hosted manifests still work." },
      { status: 501 }
    );
  }

  try {
    const args = [String(id)];
    if (voice) args.push(voice);
    const { stdout } = await execFileAsync(generatorScript, args, {
      cwd: path.join(process.cwd(), "workspace"),
      env: process.env,
      timeout: 10 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 4
    });

    const result = JSON.parse(stdout.trim()) as unknown;
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate DJ-hosted mix.";
    return Response.json({ error: message }, { status: 500 });
  }
}
