export type SynthesizedAudio = {
  audio: Buffer;
  mimeType: string;
};

export interface TtsProvider {
  readonly id: string;
  synthesize(text: string, opts: { voiceId: string }): Promise<SynthesizedAudio>;
}

export type VoiceOption = {
  id: string;
  label: string;
};
