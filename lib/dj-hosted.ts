import fs from "node:fs";
import path from "node:path";

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

const generatedMixtapesDir = path.join(process.cwd(), "workspace", "data", "generated-mixtapes");
const clipExtensions = [".mp3", ".wav", ".m4a", ".ogg", ".aac"];
const compiledAudioNames = ["mix.mp3", "hosted-mixtape.mp3", "broadcast.mp3"];

function mixDir(mixId: number): string {
  return path.join(generatedMixtapesDir, `${mixId}-dj-hosted`);
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readDjHostedManifest(mixId: number): DjHostedManifest | null {
  const dir = mixDir(mixId);
  const manifestPath = path.join(dir, "dj-script.json");
  if (!fs.existsSync(manifestPath)) return null;

  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  const rawSegments = isObject(parsed.segments) ? parsed.segments : {};
  const rawClips = isObject(parsed.clips) ? parsed.clips : {};
  const availableClips = Object.fromEntries(
    Object.entries(rawClips).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(clipFilePath(dir, entry[0]))
    )
  );
  const hasCompiledAudio = Boolean(compiledAudioPath(dir));

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
    streamUrl: hasCompiledAudio && typeof parsed.streamUrl === "string" ? parsed.streamUrl : undefined,
    downloadUrl: hasCompiledAudio && typeof parsed.downloadUrl === "string" ? parsed.downloadUrl : undefined,
    hasClipAudio: Object.keys(availableClips).length > 0,
    hasCompiledAudio
  };
}

export function findDjHostedClip(mixId: number, clipName: string): string | null {
  return clipFilePath(mixDir(mixId), clipName);
}

export function findDjHostedCompiledAudio(mixId: number): string | null {
  return compiledAudioPath(mixDir(mixId));
}
