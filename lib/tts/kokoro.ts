import path from "node:path";
import type { SynthesizedAudio, TtsProvider } from "./types";
import { pcmFloat32ToWav } from "./wav";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const CACHE_DIR = path.join(process.cwd(), "workspace", "models", "kokoro");

let modelPromise: Promise<unknown> | null = null;

async function importKokoro() {
  // Keep the package specifier out of webpack's static graph; onnxruntime-node is too large for Vercel serverless bundles.
  const packageName = "kokoro" + "-js";
  return import(/* webpackIgnore: true */ packageName) as Promise<{
    KokoroTTS: { from_pretrained: (id: string, opts: { dtype?: string; device?: string }) => Promise<unknown> };
  }>;
}

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      process.env.HF_HOME = process.env.HF_HOME || CACHE_DIR;
      process.env.TRANSFORMERS_CACHE = process.env.TRANSFORMERS_CACHE || CACHE_DIR;
      const mod = await importKokoro();
      return mod.KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" });
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

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
