import type { SynthesizedAudio } from "./tts/types";

function sniffAudioMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return "audio/mpeg";
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  if (buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (buf.toString("ascii", 0, 4) === "fLaC") return "audio/flac";
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "audio/webm";
  return null;
}

/**
 * Some TTS APIs return JSON with base64 audio, wrong Content-Type (e.g. application/json),
 * or raw bytes that don't match the declared MIME. Normalize before upload so Pinata URLs
 * are playable in the browser.
 */
export function normalizeSynthesizedAudio(input: SynthesizedAudio): SynthesizedAudio {
  let buf = Buffer.isBuffer(input.audio) ? input.audio : Buffer.from(input.audio);
  let mime = (input.mimeType || "").split(";")[0]?.trim() || "";

  const previewLen = Math.min(2048, buf.length);
  const head = buf.subarray(0, previewLen).toString("utf8").trimStart();
  if (head.startsWith("{") || mime.includes("json")) {
    try {
      const json = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
      const b64 =
        typeof json.audio_data === "string"
          ? json.audio_data
          : typeof json.audio === "string"
            ? json.audio
            : typeof json.audio_base64 === "string"
              ? json.audio_base64
              : typeof json.data === "string" && (json.data as string).length > 64
                ? (json.data as string)
                : null;
      if (b64) {
        const dataUrl = /^data:([^;,]+)?;base64,(.+)$/i.exec(b64.trim());
        if (dataUrl?.[1]) mime = dataUrl[1];
        buf = Buffer.from(dataUrl?.[2] ?? b64, "base64");
        mime =
          (typeof json.mime_type === "string" && json.mime_type) ||
          (typeof json.content_type === "string" && json.content_type) ||
          (typeof json.format === "string" ? `audio/${json.format}` : "") ||
          mime;
      }
    } catch {
      // keep binary buffer
    }
  }

  const sniffed = sniffAudioMime(buf);
  if (sniffed) mime = sniffed;
  else if (!mime.startsWith("audio/")) mime = "audio/mpeg";

  return { audio: buf, mimeType: mime };
}
