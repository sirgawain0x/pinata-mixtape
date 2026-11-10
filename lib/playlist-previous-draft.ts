import { z } from "zod";
const trackInputSchema = z.object({
  title: z.string().min(1).max(160),
  artist: z.string().min(1).max(120),
  releaseYear: z.string().max(8).optional(),
  releaseDate: z.string().max(32).optional(),
  albumTitle: z.string().max(200).optional(),
  duration: z.string().max(16).optional(),
  bpm: z.string().max(16).optional(),
  energy: z.string().max(32).optional(),
  moodTags: z.array(z.string().max(64)).max(24).optional(),
  sceneTags: z.array(z.string().max(64)).max(24).optional(),
  notes: z.string().max(2000).optional(),
  musicbrainzId: z.string().max(64).optional(),
  musicbrainzUrl: z.string().max(2048).optional(),
  youtubeUrl: z.string().max(2048).optional(),
  listenUrl: z.string().max(2048).optional(),
  creativeTvUrl: z.string().max(2048).optional(),
});

export const previousDraftSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(1000).optional(),
    creators: z.array(z.string().max(120)).max(20).optional(),
    genre: z.string().max(80).optional(),
    sourceUrl: z.string().max(2048).optional(),
    tracks: z.array(trackInputSchema).max(100).optional(),
  })
  .strict();

export type PreviousDraftInput = z.infer<typeof previousDraftSchema>;
