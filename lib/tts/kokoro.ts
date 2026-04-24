import path from "node:path";
import type { SynthesizedAudio, TtsProvider, VoiceOption } from "./types";
import { pcmFloat32ToWav } from "./wav";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const CACHE_DIR = path.join(process.cwd(), "workspace", "models", "kokoro");

let modelPromise: Promise<unknown> | null = null;

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      process.env.HF_HOME = process.env.HF_HOME || CACHE_DIR;
      process.env.TRANSFORMERS_CACHE = process.env.TRANSFORMERS_CACHE || CACHE_DIR;
      const mod = (await import("kokoro-js")) as {
        KokoroTTS: { from_pretrained: (id: string, opts: { dtype?: string; device?: string }) => Promise<unknown> };
      };
      return mod.KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" });
    })();
  }
  return modelPromise;
}

export const KOKORO_VOICES: VoiceOption[] = [
  { id: "kokoro:af_heart", label: "Heart (American, Female)" },
  { id: "kokoro:af_bella", label: "Bella (American, Female)" },
  { id: "kokoro:am_michael", label: "Michael (American, Male)" },
  { id: "kokoro:bf_emma", label: "Emma (British, Female)" },
  { id: "kokoro:bm_george", label: "George (British, Male)" }
];

function shortVoiceId(voiceId: string): string {
  return voiceId.startsWith("kokoro:") ? voiceId.slice("kokoro:".length) : voiceId;
}

export const KokoroProvider: TtsProvider = {
  id: "kokoro",
  async synthesize(text, opts): Promise<SynthesizedAudio> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Text is empty.");
    const model = (await loadModel()) as {
      generate: (text: string, opts: { voice: string }) => Promise<{ audio: Float32Array; sampling_rate: number }>;
    };
    const result = await model.generate(trimmed, { voice: shortVoiceId(opts.voiceId) || "af_heart" });
    const wav = pcmFloat32ToWav(result.audio, result.sampling_rate);
    return { audio: wav, mimeType: "audio/wav" };
  }
};
