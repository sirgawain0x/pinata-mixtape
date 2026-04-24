import type { SynthesizedAudio, TtsProvider, VoiceOption } from "./types";

const DEFAULT_BASE_URL = "https://studio.mosi.cn";

function baseUrl(): string {
  return (process.env.MOSI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function authHeaders(): Headers {
  const apiKey = process.env.MOSI_API_KEY;
  if (!apiKey) throw new Error("MOSI_API_KEY is not configured.");
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  return headers;
}

export function isMosiConfigured(): boolean {
  return Boolean(process.env.MOSI_API_KEY);
}

export type MosiUploadResult = { fileId: string };
export type MosiCloneResult = { voiceId: string; status: "PENDING" | "ACTIVE" | "FAILED" };

export async function uploadMosiReference(file: Blob, name: string): Promise<MosiUploadResult> {
  const headers = authHeaders();
  const form = new FormData();
  form.append("file", file, name);
  const response = await fetch(`${baseUrl()}/api/v1/files/upload`, {
    method: "POST",
    headers,
    body: form
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Mosi upload failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as { file_id?: string };
  if (!data.file_id) throw new Error("Mosi upload missing file_id.");
  return { fileId: data.file_id };
}

export async function createMosiVoiceClone(input: { fileId: string; text?: string }): Promise<MosiCloneResult> {
  const headers = authHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl()}/api/v1/voice/clone`, {
    method: "POST",
    headers,
    body: JSON.stringify({ file_id: input.fileId, text: input.text })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Mosi clone failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as { voice_id?: string; status?: string };
  if (!data.voice_id) throw new Error("Mosi clone missing voice_id.");
  return {
    voiceId: data.voice_id,
    status: (data.status as MosiCloneResult["status"]) ?? "PENDING"
  };
}

export async function getMosiVoiceStatus(voiceId: string): Promise<MosiCloneResult> {
  const headers = authHeaders();
  const response = await fetch(`${baseUrl()}/api/v1/voices/${encodeURIComponent(voiceId)}`, { headers });
  if (!response.ok) {
    throw new Error(`Mosi status fetch failed (${response.status}).`);
  }
  const data = (await response.json()) as { voice_id?: string; status?: string };
  return {
    voiceId: data.voice_id ?? voiceId,
    status: (data.status as MosiCloneResult["status"]) ?? "PENDING"
  };
}

export async function listMosiVoices(): Promise<VoiceOption[]> {
  if (!isMosiConfigured()) return [];
  const headers = authHeaders();
  const response = await fetch(`${baseUrl()}/api/v1/voices?status=ACTIVE&limit=50`, { headers });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    voices?: { voice_id: string; voice_name?: string; source_type?: string }[];
  };
  return (data.voices ?? []).map((voice) => ({
    id: `mosi:${voice.voice_id}`,
    label: voice.voice_name || `Mosi voice ${voice.voice_id.slice(0, 6)}`
  }));
}

function shortVoiceId(voiceId: string): string {
  return voiceId.startsWith("mosi:") ? voiceId.slice("mosi:".length) : voiceId;
}

export const MosiProvider: TtsProvider = {
  id: "mosi",
  async synthesize(text, opts): Promise<SynthesizedAudio> {
    const headers = authHeaders();
    headers.set("Content-Type", "application/json");
    const response = await fetch(`${baseUrl()}/api/v1/audio/speech`, {
      method: "POST",
      headers,
      body: JSON.stringify({ voice_id: shortVoiceId(opts.voiceId), input: text })
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Mosi synthesis failed (${response.status}): ${errorText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") || "audio/mpeg";
    return { audio: Buffer.from(arrayBuffer), mimeType };
  }
};
