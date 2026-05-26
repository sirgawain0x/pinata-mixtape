import fs from "node:fs";
import path from "node:path";
import { dbReady } from "./db";
import { isPinataConfigured, uploadFile } from "./pinata";
import { sqlGet, sqlRun } from "./sql-bridge";

export type DjHostedTrack = {
  title: string;
  artist: string;
  releaseYear?: string;
  duration?: string;
  bpm?: string;
  energy?: string;
  moodTags?: string[];
  sceneTags?: string[];
  notes?: string;
  musicbrainzUrl?: string;
  youtubeUrl?: string;
  listenUrl?: string;
  youtubeId?: string;
};

export type DjHostedManifest = {
  mixId: number;
  mixTitle: string;
  voice: string;
  model: string;
  segments: Record<string, string>;
  sourceTracks: DjHostedTrack[];
  clips: Record<string, string>;
  streamUrl?: string;
  downloadUrl?: string;
  hasClipAudio: boolean;
  hasCompiledAudio: boolean;
};

export type DjHostedClientResult = {
  mixId: number;
  mixTitle: string;
  voice: string;
  model: string;
  streamUrl?: string;
  downloadUrl?: string;
  clips: Record<string, string>;
  sourceTracks: DjHostedTrack[];
  segments: Record<string, string>;
  hasClipAudio: boolean;
  hasCompiledAudio: boolean;
};

const generatedMixtapesDir = path.join(process.cwd(), "workspace", "data", "generated-mixtapes");
const clipExtensions = [".mp3", ".wav", ".m4a", ".ogg", ".aac"];
const compiledAudioNames = ["mix.mp3", "hosted-mixtape.mp3", "broadcast.mp3"];

function mixDir(mixId: number): string {
  return path.join(generatedMixtapesDir, `${mixId}-dj-hosted`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRemoteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function clipFilePath(dir: string, clipName: string): string | null {
  for (const extension of clipExtensions) {
    const candidate = path.join(dir, `${clipName}${extension}`);
    if (fs.existsSync(candidate)) return candidate;
    const normalizedCandidate = path.join(dir, "normalized", `${clipName}${extension}`);
    if (fs.existsSync(normalizedCandidate)) return normalizedCandidate;
  }
  return null;
}

function compiledAudioPath(dir: string): string | null {
  for (const name of compiledAudioNames) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function parseManifestRecord(
  parsed: Record<string, unknown>,
  mixId: number,
  options: { dir?: string; requireLocalClipFiles?: boolean } = {}
): DjHostedManifest {
  const rawSegments = isObject(parsed.segments) ? parsed.segments : {};
  const rawClips = isObject(parsed.clips) ? parsed.clips : {};
  const dir = options.dir ?? mixDir(mixId);

  const availableClips = Object.fromEntries(
    Object.entries(rawClips).filter((entry): entry is [string, string] => {
      if (typeof entry[1] !== "string" || !entry[1]) return false;
      if (isRemoteUrl(entry[1])) return true;
      if (!options.requireLocalClipFiles) return true;
      return Boolean(clipFilePath(dir, entry[0]));
    })
  );

  const hasCompiledAudio =
    Boolean(compiledAudioPath(dir)) ||
    (typeof parsed.streamUrl === "string" && isRemoteUrl(parsed.streamUrl));

  const streamUrl =
    typeof parsed.streamUrl === "string"
      ? parsed.streamUrl
      : hasCompiledAudio
        ? `/app/api/mixes/${mixId}/dj-hosted/file?mode=stream`
        : undefined;
  const downloadUrl =
    typeof parsed.downloadUrl === "string"
      ? parsed.downloadUrl
      : hasCompiledAudio
        ? `/app/api/mixes/${mixId}/dj-hosted/file?mode=download`
        : undefined;

  return {
    mixId: Number(parsed.mixId) || mixId,
    mixTitle: typeof parsed.mixTitle === "string" ? parsed.mixTitle : "",
    voice: typeof parsed.voice === "string" ? parsed.voice : "",
    model: typeof parsed.model === "string" ? parsed.model : "",
    segments: Object.fromEntries(
      Object.entries(rawSegments).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    ),
    sourceTracks: Array.isArray(parsed.sourceTracks)
      ? parsed.sourceTracks.filter((track): track is DjHostedTrack => isObject(track))
      : [],
    clips: availableClips,
    streamUrl: hasCompiledAudio ? streamUrl : undefined,
    downloadUrl: hasCompiledAudio ? downloadUrl : undefined,
    hasClipAudio: Object.keys(availableClips).length > 0,
    hasCompiledAudio
  };
}

function readDjHostedManifestFromDisk(mixId: number): DjHostedManifest | null {
  const dir = mixDir(mixId);
  const manifestPath = path.join(dir, "dj-script.json");
  if (!fs.existsSync(manifestPath)) return null;

  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  return parseManifestRecord(parsed, mixId, { dir, requireLocalClipFiles: true });
}

async function loadDjHostedManifestFromDb(mixId: number): Promise<DjHostedManifest | null> {
  await dbReady();
  const row = await sqlGet<{ manifest_json: string }>(
    `SELECT manifest_json FROM mix_dj_hosted WHERE mix_id = ?`,
    [mixId]
  );
  if (!row?.manifest_json) return null;

  try {
    const parsed = JSON.parse(row.manifest_json) as Record<string, unknown>;
    return parseManifestRecord(parsed, mixId, { requireLocalClipFiles: false });
  } catch {
    return null;
  }
}

export async function saveDjHostedManifest(mixId: number, manifest: DjHostedManifest): Promise<void> {
  await dbReady();
  const payload = {
    mixId: manifest.mixId,
    mixTitle: manifest.mixTitle,
    voice: manifest.voice,
    model: manifest.model,
    segments: manifest.segments,
    sourceTracks: manifest.sourceTracks,
    clips: manifest.clips,
    streamUrl: manifest.streamUrl,
    downloadUrl: manifest.downloadUrl
  };

  await sqlRun(
    `INSERT INTO mix_dj_hosted (mix_id, manifest_json, updated_at)
     VALUES (@mixId, @manifestJson, CURRENT_TIMESTAMP)
     ON CONFLICT(mix_id) DO UPDATE SET
       manifest_json = excluded.manifest_json,
       updated_at = CURRENT_TIMESTAMP`,
    { mixId, manifestJson: JSON.stringify(payload) }
  );
}

export async function readDjHostedManifest(mixId: number): Promise<DjHostedManifest | null> {
  const fromDb = await loadDjHostedManifestFromDb(mixId);
  if (fromDb) return fromDb;
  return readDjHostedManifestFromDisk(mixId);
}

export function manifestToClientResult(manifest: DjHostedManifest, mixId: number): DjHostedClientResult {
  return {
    mixId: manifest.mixId,
    mixTitle: manifest.mixTitle,
    voice: manifest.voice,
    model: manifest.model,
    streamUrl: manifest.streamUrl ?? `/app/api/mixes/${mixId}/dj-hosted/file?mode=stream`,
    downloadUrl: manifest.downloadUrl ?? `/app/api/mixes/${mixId}/dj-hosted/file?mode=download`,
    clips: manifest.clips,
    sourceTracks: manifest.sourceTracks,
    segments: manifest.segments,
    hasClipAudio: manifest.hasClipAudio,
    hasCompiledAudio: manifest.hasCompiledAudio
  };
}

export async function getDjHostedClipTarget(mixId: number, clipName: string): Promise<string | null> {
  const manifest = await readDjHostedManifest(mixId);
  if (!manifest) return null;

  const clip = manifest.clips[clipName];
  if (clip && isRemoteUrl(clip)) return clip;

  const local = findDjHostedClipOnDisk(mixId, clipName);
  return local;
}

export function findDjHostedClipOnDisk(mixId: number, clipName: string): string | null {
  return clipFilePath(mixDir(mixId), clipName);
}

/** @deprecated Use getDjHostedClipTarget — kept for sync disk-only callers during migration */
export function findDjHostedClip(mixId: number, clipName: string): string | null {
  return findDjHostedClipOnDisk(mixId, clipName);
}

export function findDjHostedCompiledAudio(mixId: number): string | null {
  return compiledAudioPath(mixDir(mixId));
}

export async function getDjHostedCompiledAudioTarget(
  mixId: number,
  mode: "stream" | "download"
): Promise<string | null> {
  const manifest = await readDjHostedManifest(mixId);
  if (manifest) {
    const url = mode === "download" ? manifest.downloadUrl : manifest.streamUrl;
    if (url && isRemoteUrl(url)) return url;
  }
  return findDjHostedCompiledAudio(mixId);
}

export async function persistDjHostedArtifacts(mixId: number): Promise<DjHostedManifest | null> {
  const manifest = readDjHostedManifestFromDisk(mixId);
  if (!manifest) return null;

  if (isPinataConfigured()) {
    const dir = mixDir(mixId);
    const uploadedClips: Record<string, string> = {};

    for (const clipName of Object.keys(manifest.clips)) {
      const filePath = clipFilePath(dir, clipName);
      if (!filePath) continue;
      try {
        const buffer = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).slice(1) || "mp3";
        const upload = await uploadFile(buffer, {
          name: `mix-${mixId}-dj-${clipName}.${ext}`,
          mimeType: ext === "mp3" ? "audio/mpeg" : undefined
        });
        uploadedClips[clipName] = upload.url;
      } catch {
        uploadedClips[clipName] = manifest.clips[clipName] ?? `/app/api/mixes/${mixId}/dj-hosted/clip/${clipName}`;
      }
    }

    manifest.clips = { ...manifest.clips, ...uploadedClips };
    manifest.hasClipAudio = Object.keys(manifest.clips).length > 0;

    const compiled = compiledAudioPath(dir);
    if (compiled) {
      try {
        const buffer = await fs.promises.readFile(compiled);
        const upload = await uploadFile(buffer, {
          name: `mix-${mixId}-dj-broadcast.mp3`,
          mimeType: "audio/mpeg"
        });
        manifest.streamUrl = upload.url;
        manifest.downloadUrl = upload.url;
        manifest.hasCompiledAudio = true;
      } catch {
        // keep API-relative URLs
      }
    }
  }

  await saveDjHostedManifest(mixId, manifest);
  return manifest;
}
