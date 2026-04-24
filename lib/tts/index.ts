import { KokoroProvider, KOKORO_VOICES } from "./kokoro";
import { MosiProvider, isMosiConfigured, listMosiVoices } from "./mosi";
import type { TtsProvider, VoiceOption } from "./types";

export type { TtsProvider, VoiceOption } from "./types";

export function resolveProvider(voiceId: string): TtsProvider {
  if (voiceId.startsWith("mosi:")) {
    if (!isMosiConfigured()) throw new Error("Mosi voice selected but MOSI_API_KEY is not configured.");
    return MosiProvider;
  }
  return KokoroProvider;
}

export async function listAvailableVoices(): Promise<{ voices: VoiceOption[]; defaultVoiceId: string }> {
  const voices: VoiceOption[] = [...KOKORO_VOICES];
  if (isMosiConfigured()) {
    try {
      const mosiVoices = await listMosiVoices();
      voices.unshift(...mosiVoices);
    } catch {
      // Mosi listing is best-effort; fall back to Kokoro
    }
  }
  return {
    voices,
    defaultVoiceId: voices[0]?.id ?? "kokoro:af_heart"
  };
}
