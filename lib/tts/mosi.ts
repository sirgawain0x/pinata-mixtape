import type { SynthesizedAudio, TtsProvider, VoiceOption } from "./types";
import { assertSameOriginOrRelativeUrl, fetchWithTimeout } from "../outbound";

const DEFAULT_BASE_URL = "https://studio.mosi.cn";
let cachedSpeechModel: string | null = null;
const MOSI_TIMEOUT_MS = 20_000;

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

function configuredSpeechModel(): string {
  return (process.env.MOSI_SPEECH_MODEL || process.env.MOSI_MODEL || "").trim();
}

async function detectSpeechModel(headers: Headers): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`${baseUrl()}/api/v1/models`, { headers }, MOSI_TIMEOUT_MS);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      data?: Array<{ id?: string; endpoints?: string[]; modes?: string[]; capabilities?: string[] }>;
      models?: Array<{ id?: string; endpoints?: string[]; modes?: string[]; capabilities?: string[] }>;
    };
    const models = data.data ?? data.models ?? [];
    const supportsSpeech = (model: { endpoints?: string[]; modes?: string[]; capabilities?: string[] }) =>
      (model.endpoints ?? []).includes("/audio/speech") ||
      (model.modes ?? []).includes("audio/speech") ||
      (model.capabilities ?? []).includes("audio/speech");
    const match = models.find((model) => model.id && supportsSpeech(model)) ?? models.find((model) => model.id);
    return match?.id?.trim() || null;
  } catch {
    return null;
  }
}

async function resolveSpeechModel(headers: Headers): Promise<string> {
  if (cachedSpeechModel) return cachedSpeechModel;
  const configured = configuredSpeechModel();
  if (configured) {
    cachedSpeechModel = configured;
    return configured;
  }
  const detected = await detectSpeechModel(headers);
  if (detected) {
    cachedSpeechModel = detected;
    return detected;
  }
  throw new Error("MOSI speech model is not configured. Set MOSI_SPEECH_MODEL in .env.local.");
}

export function isMosiConfigured(): boolean {
  return Boolean(process.env.MOSI_API_KEY);
}

export type MosiUploadResult = { fileId: string };
export type MosiCloneResult = { voiceId: string; status: "PENDING" | "ACTIVE" | "FAILED" };
const MOSI_STATUSES = new Set<MosiCloneResult["status"]>(["PENDING", "ACTIVE", "FAILED"]);

function normalizeMosiStatus(status: unknown): MosiCloneResult["status"] {
  return typeof status === "string" && MOSI_STATUSES.has(status as MosiCloneResult["status"])
    ? (status as MosiCloneResult["status"])
    : "PENDING";
}

export async function uploadMosiReference(file: Blob, name: string): Promise<MosiUploadResult> {
  const headers = authHeaders();
  const form = new FormData();
  form.append("file", file, name);
  const response = await fetchWithTimeout(`${baseUrl()}/api/v1/files/upload`, {
    method: "POST",
    headers,
    body: form
  }, MOSI_TIMEOUT_MS);
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
  const response = await fetchWithTimeout(`${baseUrl()}/api/v1/voice/clone`, {
    method: "POST",
    headers,
    body: JSON.stringify({ file_id: input.fileId, text: input.text })
  }, MOSI_TIMEOUT_MS);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Mosi clone failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as { voice_id?: string; status?: string };
  if (!data.voice_id) throw new Error("Mosi clone missing voice_id.");
  return {
    voiceId: data.voice_id,
    status: normalizeMosiStatus(data.status)
  };
}

export async function getMosiVoiceStatus(voiceId: string): Promise<MosiCloneResult> {
  const headers = authHeaders();
  const response = await fetchWithTimeout(
    `${baseUrl()}/api/v1/voices/${encodeURIComponent(voiceId)}`,
    { headers },
    MOSI_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(`Mosi status fetch failed (${response.status}).`);
  }
  const data = (await response.json()) as { voice_id?: string; status?: string };
  return {
    voiceId: data.voice_id ?? voiceId,
    status: normalizeMosiStatus(data.status)
  };
}

/** Best-effort remote delete; 404 = already gone; 405 = API may not expose DELETE (caller still removes local row). */
export async function deleteMosiVoice(externalVoiceId: string): Promise<void> {
  if (!isMosiConfigured()) return;
  const headers = authHeaders();
  const response = await fetchWithTimeout(`${baseUrl()}/api/v1/voices/${encodeURIComponent(externalVoiceId)}`, {
    method: "DELETE",
    headers
  }, MOSI_TIMEOUT_MS);
  if (response.ok || response.status === 404 || response.status === 405) return;
  const text = await response.text().catch(() => "");
  throw new Error(`Mosi voice delete failed (${response.status}): ${text}`);
}

export async function listMosiVoices(): Promise<VoiceOption[]> {
  if (!isMosiConfigured()) return [];
  const headers = authHeaders();
  const response = await fetchWithTimeout(`${baseUrl()}/api/v1/voices?status=ACTIVE&limit=50`, { headers }, MOSI_TIMEOUT_MS);
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
  let id = voiceId.trim();
  while (id.toLowerCase().startsWith("mosi:")) {
    id = id.slice("mosi:".length).trim();
  }
  return id;
}

async function parseMosiSpeechResponse(response: Response): Promise<SynthesizedAudio> {
  const declaredMime = (response.headers.get("content-type") || "").split(";")[0]?.trim() || "";
  const buf = Buffer.from(await response.arrayBuffer());
  const trimStart = buf.subarray(0, Math.min(256, buf.length)).toString("utf8").trimStart();
  const looksJson =
    declaredMime.includes("json") ||
    trimStart.startsWith("{");

  if (looksJson && trimStart.startsWith("{")) {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
    } catch {
      return { audio: buf, mimeType: declaredMime || "audio/mpeg" };
    }

    if (typeof json.error === "string" && json.error) {
      throw new Error(`Mosi: ${json.error}`);
    }

    const pickUrl = (o: Record<string, unknown>): string | null => {
      for (const key of ["url", "audio_url", "file_url", "download_url", "output_url"]) {
        const v = o[key];
        if (typeof v === "string" && (v.startsWith("http") || v.startsWith("/"))) return v;
      }
      return null;
    };

    const remoteUrl = pickUrl(json);
    if (remoteUrl) {
      const providerBase = baseUrl();
      const absolute = assertSameOriginOrRelativeUrl(remoteUrl, providerBase, "Mosi audio URL");
      const innerHeaders = absolute.origin === new URL(providerBase).origin ? authHeaders() : undefined;
      const inner = await fetchWithTimeout(
        absolute,
        innerHeaders ? { headers: innerHeaders } : undefined,
        MOSI_TIMEOUT_MS
      );
      if (!inner.ok) {
        const t = await inner.text().catch(() => "");
        throw new Error(`Mosi audio download failed (${inner.status}): ${t.slice(0, 240)}`);
      }
      const innerMime = (inner.headers.get("content-type") || "").split(";")[0] || "audio/mpeg";
      return { audio: Buffer.from(await inner.arrayBuffer()), mimeType: innerMime };
    }

    const pickB64 = (o: Record<string, unknown>): { data: string; mime?: string } | null => {
      const mime =
        (typeof o.mime_type === "string" && o.mime_type) ||
        (typeof o.content_type === "string" && o.content_type) ||
        undefined;
      for (const key of [
        "audio_data",
        "audioData",
        "audio",
        "audio_base64",
        "data",
        "output",
        "result",
        "speech",
        "file",
        "content"
      ]) {
        const v = o[key];
        if (typeof v === "string" && v.length > 24) return { data: v, mime };
      }
      const audioNested = o.audio;
      if (audioNested && typeof audioNested === "object" && !Array.isArray(audioNested)) {
        return pickB64(audioNested as Record<string, unknown>);
      }
      return null;
    };

    const b64 = pickB64(json);
    if (b64) {
      try {
        const data = b64.data.includes(",") ? b64.data.split(",", 2)[1] : b64.data;
        const raw = Buffer.from(data, "base64");
        const dataUrlMime = /^data:([^;,]+);base64,/i.exec(b64.data)?.[1];
        return { audio: raw, mimeType: (dataUrlMime || b64.mime || declaredMime || "audio/mpeg").split(";")[0] };
      } catch {
        throw new Error("Mosi returned invalid base64 audio.");
      }
    }

    const maybeBytes = json.audio_data;
    if (Array.isArray(maybeBytes) && maybeBytes.length > 0 && maybeBytes.every((x) => typeof x === "number")) {
      return {
        audio: Buffer.from(maybeBytes as number[]),
        mimeType: declaredMime || "audio/mpeg"
      };
    }

    throw new Error(
      `Mosi returned JSON without playable audio (keys: ${Object.keys(json).slice(0, 12).join(", ")}).`
    );
  }

  return { audio: buf, mimeType: declaredMime || "audio/mpeg" };
}

export const MosiProvider: TtsProvider = {
  id: "mosi",
  async synthesize(text, opts): Promise<SynthesizedAudio> {
    const headers = authHeaders();
    headers.set("Content-Type", "application/json");
    const model = await resolveSpeechModel(headers);
    // Moss TTS validates `text` (MossTTSRequest.Text). Other models often accept `input`; send both.
    const response = await fetchWithTimeout(`${baseUrl()}/api/v1/audio/speech`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        voice_id: shortVoiceId(opts.voiceId),
        input: text,
        text
      })
    }, MOSI_TIMEOUT_MS);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Mosi synthesis failed (${response.status}) [model=${model}]: ${errorText}`);
    }
    return parseMosiSpeechResponse(response);
  }
};
