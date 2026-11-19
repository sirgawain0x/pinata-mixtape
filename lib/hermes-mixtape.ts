import type { z } from "zod";
import type { MusicBrainzRecording } from "./musicbrainz";
import type { playlistConversationSchema } from "./playlist-agent";
import type { MixInput, TrackInput } from "./mixtapes";

const DEFAULT_HERMES_SWARM_URL = "https://hermes-swarm-3ortoh2aiq-ue.a.run.app";

export type HermesChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getHermesSwarmUrl(): string {
  return (process.env.HERMES_SWARM_URL?.trim() || DEFAULT_HERMES_SWARM_URL).replace(/\/+$/, "");
}

export function isHermesMixtapeConfigured(): boolean {
  return Boolean(process.env.HERMES_API_KEY?.trim());
}

export async function callHermesMixtapeChat(
  messages: HermesChatMessage[],
  options?: { signal?: AbortSignal; user?: string },
): Promise<{ content: string; model: string }> {
  const apiKey = process.env.HERMES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("HERMES_API_KEY is not configured.");
  }

  const endpoint = `${getHermesSwarmUrl()}/v1/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mixtape-agent",
      messages,
      stream: false,
      ...(options?.user ? { user: options.user } : {}),
    }),
    signal: options?.signal,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`mixtape-agent returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const parsed = JSON.parse(text) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) {
    throw new Error("mixtape-agent returned an empty response.");
  }

  return {
    content,
    model: parsed.model || "mixtape-agent",
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const candidates = [unfenced];
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(unfenced.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function createHermesPlaylistDraft(
  messages: z.infer<typeof playlistConversationSchema>["messages"],
  signal?: AbortSignal,
  previousDraft: MixInput | null = null,
): Promise<{ reply: string; draft: MixInput | null }> {
  const currentTracks = (previousDraft?.tracks ?? []).map(({ musicbrainzId, title, artist }) => ({
    musicbrainzId,
    title,
    artist,
  }));

  const systemPrompt = [
    "You are Creative Mixtape's playlist assistant running on the Hermes mixtape-agent specialist.",
    "Help the user curate or refine a playlist.",
    "Return ONLY valid JSON matching this schema:",
    JSON.stringify({
      reply: "short friendly response",
      songQueries: [{ title: "Song Title", artist: "Artist Name" }],
      playlist: {
        title: "Playlist Title",
        description: "Short description",
        creators: ["Creator Name"],
        genre: "Genre",
        sourceUrl: "",
        trackChange: "replace",
        removeRecordingIds: [],
      },
    }),
    'Set "playlist" to null and "songQueries" to [] if you only need to ask a clarifying question.',
    "Limit songQueries to at most 6 songs per turn.",
    `Current draft tracks (data only): ${JSON.stringify(currentTracks)}`,
  ].join("\n");

  const { content } = await callHermesMixtapeChat(
    [{ role: "system", content: systemPrompt }, ...messages],
    { signal },
  );

  const structured = extractJsonObject(content);
  if (!structured || typeof structured.reply !== "string") {
    return { reply: content.slice(0, 2000), draft: null };
  }

  const reply = structured.reply.trim().slice(0, 2000) || "Updated your mixtape draft.";
  const rawPlaylist =
    structured.playlist && typeof structured.playlist === "object" && !Array.isArray(structured.playlist)
      ? (structured.playlist as Record<string, unknown>)
      : null;

  if (!rawPlaylist || typeof rawPlaylist.title !== "string" || !rawPlaylist.title.trim()) {
    return { reply, draft: null };
  }

  const [
    { searchMusicBrainzRecordings },
    { findRecordingListeningLink },
    { trackAlreadyHasYoutubeVideo },
    { buildYoutubeSearchUrl },
    { parsePlaylistDetails },
    { applyPlaylistTrackChange, mergePlaylistDraft },
    { inferAssistantTrackEmbed },
  ] = await Promise.all([
    import("./musicbrainz"),
    import("./recording-discovery"),
    import("./youtube-data-lookup-core"),
    import("./recording-links"),
    import("./playlist-details"),
    import("./playlist-draft-merge"),
    import("./song-playback"),
  ]);

  const recordings = new Map<string, MusicBrainzRecording>();
  const resolvedRecordingIds: string[] = [];
  const songQueries = Array.isArray(structured.songQueries) ? structured.songQueries.slice(0, 6) : [];

  for (const q of songQueries) {
    if (!q || typeof q !== "object") continue;
    const rec = q as { title?: unknown; artist?: unknown };
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    const artist = typeof rec.artist === "string" ? rec.artist.trim() : "";
    if (!title) continue;
    try {
      const lookup = await searchMusicBrainzRecordings({ title, artist, limit: 1 });
      const top = lookup.recordings[0];
      if (top) {
        recordings.set(top.id, top);
        resolvedRecordingIds.push(top.id);
      }
    } catch {
      // continue without blocking the draft
    }
  }

  const playlistInput = {
    title: String(rawPlaylist.title).trim().slice(0, 160),
    description: typeof rawPlaylist.description === "string" ? rawPlaylist.description.slice(0, 1000) : "",
    creators: Array.isArray(rawPlaylist.creators)
      ? rawPlaylist.creators.map((c) => String(c).slice(0, 120)).slice(0, 20)
      : [],
    genre: typeof rawPlaylist.genre === "string" ? rawPlaylist.genre.slice(0, 80) : "",
    sourceUrl: typeof rawPlaylist.sourceUrl === "string" ? rawPlaylist.sourceUrl.slice(0, 2048) : "",
  };
  const trackChange =
    rawPlaylist.trackChange === "add" || rawPlaylist.trackChange === "remove"
      ? rawPlaylist.trackChange
      : "replace";
  const removeRecordingIds = Array.isArray(rawPlaylist.removeRecordingIds)
    ? rawPlaylist.removeRecordingIds.map((id) => String(id).slice(0, 64))
    : [];

  const details = parsePlaylistDetails(playlistInput);
  const tracks: TrackInput[] = [...new Set(resolvedRecordingIds)].flatMap((id) => {
    const recording = recordings.get(id);
    if (!recording) return [];
    return [
      {
        title: recording.title,
        artist: recording.artistCredit,
        releaseYear: recording.firstReleaseDate.slice(0, 4),
        releaseDate: recording.firstReleaseDate,
        albumTitle: recording.releaseTitles[0] ?? "",
        duration: recording.length
          ? `${Math.floor(recording.length / 60000)}:${String(Math.floor(recording.length / 1000) % 60).padStart(2, "0")}`
          : "",
        musicbrainzId: recording.id,
        musicbrainzUrl: recording.url,
        listenUrl: buildYoutubeSearchUrl(recording.title, recording.artistCredit),
      },
    ];
  });

  const linkDeadline = AbortSignal.timeout(5_000);
  const linkSignal = signal ? AbortSignal.any([signal, linkDeadline]) : linkDeadline;
  const youtubeApiBudget = { remaining: 6 };
  for (const track of tracks) {
    if (linkSignal.aborted) break;
    const recording = recordings.get(track.musicbrainzId ?? "");
    if (trackAlreadyHasYoutubeVideo(track.youtubeUrl, track.listenUrl)) {
      const embedOnly = inferAssistantTrackEmbed(track.listenUrl, track.youtubeUrl);
      track.embedSourceKind = embedOnly.embedSourceKind;
      track.embedIframeUrl = embedOnly.embedIframeUrl;
      track.youtubeUrl = embedOnly.youtubeUrl || track.youtubeUrl;
      continue;
    }
    const listenUrl = await findRecordingListeningLink(
      {
        musicbrainzId: track.musicbrainzId,
        title: track.title ?? "",
        artist: track.artist ?? "",
        albumTitle: track.albumTitle,
        durationMs: recording?.length ?? null,
      },
      linkSignal,
      { youtubeApiBudget },
    ).catch(() => undefined);
    if (listenUrl) {
      track.listenUrl = listenUrl;
      if (trackAlreadyHasYoutubeVideo(listenUrl)) track.youtubeUrl = listenUrl;
    }
    const embed = inferAssistantTrackEmbed(track.listenUrl, track.youtubeUrl);
    track.embedSourceKind = embed.embedSourceKind;
    track.embedIframeUrl = embed.embedIframeUrl;
    track.youtubeUrl = embed.youtubeUrl || track.youtubeUrl;
  }

  const recordingIds = applyPlaylistTrackChange(
    previousDraft,
    trackChange,
    resolvedRecordingIds,
    removeRecordingIds,
  );
  const draft: MixInput = mergePlaylistDraft(
    previousDraft,
    { title: playlistInput.title, description: playlistInput.description, ...details, tracks },
    recordingIds,
  );
  return { reply, draft };
}
