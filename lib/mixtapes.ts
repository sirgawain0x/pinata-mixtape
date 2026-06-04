import { parseAllowedEmbedUrl, resolveEmbedSourceKind, type EmbedSourceKind } from "./embed-sources";
import { isCreativeTvConfigured, parseCreativeTvUrl, resolvePlaybackByAssetId } from "./creative-tv";
import { searchMusicBrainzRecordings } from "./musicbrainz";
import Database from "better-sqlite3";

import { dbReady, getSqliteDatabase, useLibsql } from "./db";
import { sqlAll, sqlGet, sqlRun, txGet, txRun, withWriteTransaction } from "./sql-bridge";
import type { Transaction } from "@libsql/client";

let legacyMigrationPromise: Promise<void> | null = null;

function scheduleLegacyMixMigration(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyTracks();
  }
  return legacyMigrationPromise;
}

export type TrackInput = {
  title: string;
  artist: string;
  releaseYear?: string;
  duration?: string;
  bpm?: string;
  energy?: string;
  moodTags?: string[];
  sceneTags?: string[];
  notes?: string;
  musicbrainzId?: string;
  musicbrainzUrl?: string;
  youtubeUrl?: string;
  listenUrl?: string;
  embedSourceKind?: EmbedSourceKind;
  embedIframeUrl?: string;
  creativeTvUrl?: string;
};

export type Track = Required<
  Omit<
    TrackInput,
    | "releaseYear"
    | "duration"
    | "bpm"
    | "energy"
    | "notes"
    | "musicbrainzUrl"
    | "youtubeUrl"
    | "listenUrl"
    | "moodTags"
    | "sceneTags"
    | "musicbrainzId"
    | "embedSourceKind"
    | "embedIframeUrl"
    | "creativeTvUrl"
  >
> & {
  releaseYear: string;
  duration: string;
  bpm: string;
  energy: string;
  moodTags: string[];
  sceneTags: string[];
  notes: string;
  musicbrainzId: string;
  musicbrainzUrl: string;
  youtubeUrl: string;
  listenUrl: string;
  embedSourceKind: EmbedSourceKind;
  embedIframeUrl: string;
  creativeTvUrl: string;
  creativeTvPostId: string;
  livepeerPlaybackId: string;
  audioCid: string;
  audioUrl: string;
  durationSeconds: number | null;
  isCurated: boolean;
};

export type MixTrack = Track & { songId: number };

export type MixInput = {
  title: string;
  description?: string;
  vibe?: string;
  useCase?: string;
  duration?: string;
  djPersona?: string;
  coverTheme?: string;
  shareNote?: string;
  tags?: string[];
  tracks?: TrackInput[];
  creatorId?: number | null;
  isPublic?: boolean;
  slug?: string;
  publish?: boolean;
};

export type SongInput = TrackInput;

export type Mix = {
  id: number;
  title: string;
  description: string;
  vibe: string;
  useCase: string;
  duration: string;
  djPersona: string;
  coverTheme: string;
  shareNote: string;
  tags: string[];
  tracks: MixTrack[];
  creatorId: number | null;
  isPublic: boolean;
  slug: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Song = Track & {
  id: number;
  mixCount: number;
  mixIds: number[];
};

export type MixListFilter = {
  publicOnly?: boolean;
  viewerCreatorId?: number | null;
  limit?: number;
};

export type MixMomentInput = {
  title: string;
  body?: string;
  kind?: "memory" | "set" | "discovery" | "note";
  mixId?: number | null;
};

export type MixMoment = {
  id: number;
  title: string;
  body: string;
  kind: "memory" | "set" | "discovery" | "note";
  mixId: number | null;
  mixTitle: string;
  createdAt: string;
};

type MixRow = {
  id: number;
  title: string;
  description: string | null;
  vibe: string | null;
  use_case: string | null;
  duration: string | null;
  dj_persona: string | null;
  cover_theme: string | null;
  share_note: string | null;
  tags: string;
  tracks: string;
  is_public?: number | null;
  slug?: string | null;
  published_at?: string | null;
  creator_id?: number | null;
  created_at: string;
  updated_at: string;
};

type SongRow = {
  id: number;
  title: string;
  artist: string;
  musicbrainz_id: string | null;
  release_year: string | null;
  duration: string | null;
  bpm: string | null;
  energy: string | null;
  mood_tags: string;
  scene_tags: string;
  notes: string | null;
  musicbrainz_url: string | null;
  youtube_url: string | null;
  listen_url: string | null;
  embed_source_kind?: string | null;
  embed_iframe_url?: string | null;
  audio_cid?: string | null;
  audio_url?: string | null;
  duration_seconds?: number | null;
  is_curated?: number | null;
  creative_tv_url?: string | null;
  creative_tv_post_id?: string | null;
  livepeer_playback_id?: string | null;
};

type MixSongRow = SongRow & {
  position: number;
};

type SongListRow = SongRow & {
  mix_count: number;
  mix_ids: string;
};

type MixMomentRow = {
  id: number;
  title: string;
  body: string | null;
  kind: string;
  mix_id: number | null;
  mix_title: string | null;
  created_at: string;
};



function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item).trim()).filter(Boolean);
}

function buildMusicBrainzSearchUrl(title: string, artist: string): string {
  const query = [title, artist].filter(Boolean).join(" ");
  if (!query) return "";
  return `https://musicbrainz.org/search?query=${encodeURIComponent(query)}&type=recording&method=indexed`;
}

function buildYoutubeSearchUrl(title: string, artist: string): string {
  const query = [title, artist].filter(Boolean).join(" ");
  if (!query) return "";
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function slugifyMixTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (base.length >= 3 && SLUG_REGEX.test(base)) return base;
  const padded = (base || "tape").padEnd(3, "0").slice(0, 48);
  return padded.replace(/^-+|-+$/g, "") || "tape";
}

export async function ensureUniqueMixSlug(base: string, excludeMixId?: number): Promise<string> {
  await scheduleLegacyMixMigration();
  let candidate = slugifyMixTitle(base);
  if (!SLUG_REGEX.test(candidate)) candidate = `tape-${Date.now().toString(36).slice(-6)}`;
  let suffix = 0;
  for (;;) {
    const slug = suffix === 0 ? candidate : `${candidate}-${suffix}`;
    const row = await sqlGet<{ id: number }>(
      `SELECT id FROM mixes WHERE slug = ? COLLATE NOCASE AND (? IS NULL OR id <> ?)`,
      [slug, excludeMixId ?? null, excludeMixId ?? null]
    );
    if (!row) return slug;
    suffix += 1;
  }
}

function normalizeTrack(input: TrackInput): Track {
  const title = input.title?.trim() ?? "";
  const artist = input.artist?.trim() ?? "";
  if (!title || !artist) {
    throw new Error("Each track requires a title and artist.");
  }

  const youtubeUrl = input.youtubeUrl?.trim() || "";
  const creativeTvRaw = input.creativeTvUrl?.trim() || "";
  const parsedCreativeTv = parseCreativeTvUrl(creativeTvRaw);
  const listenUrl =
    input.listenUrl?.trim() || parsedCreativeTv?.discoverUrl || buildYoutubeSearchUrl(title, artist);
  const embedIframeRaw = input.embedIframeUrl?.trim() || "";
  const embedSourceKind = resolveEmbedSourceKind(
    input.embedSourceKind,
    youtubeUrl,
    embedIframeRaw,
    creativeTvRaw
  );
  let embedIframeUrl = "";
  if (embedSourceKind === "iframe_allowed") {
    const parsed = parseAllowedEmbedUrl(embedIframeRaw || youtubeUrl || listenUrl);
    if (!parsed) {
      throw new Error("Iframe embed URL must use an allowed music host (Spotify, SoundCloud, Bandcamp, Apple Music, YouTube).");
    }
    embedIframeUrl = parsed.toString();
  }

  const creativeTvUrl = parsedCreativeTv?.discoverUrl ?? (embedSourceKind === "creativetv" ? creativeTvRaw : "");
  const creativeTvPostId = parsedCreativeTv?.postId ?? "";

  const musicbrainzId = input.musicbrainzId?.trim() || "";
  let musicbrainzUrl = input.musicbrainzUrl?.trim() || "";
  if (!musicbrainzUrl && musicbrainzId) {
    musicbrainzUrl = `https://musicbrainz.org/recording/${musicbrainzId}`;
  }
  if (!musicbrainzUrl) {
    musicbrainzUrl = buildMusicBrainzSearchUrl(title, artist);
  }

  return {
    title,
    artist,
    releaseYear: input.releaseYear?.trim() || "",
    duration: input.duration?.trim() || "",
    bpm: input.bpm?.trim() || "",
    energy: input.energy?.trim() || "",
    moodTags: normalizeList(input.moodTags),
    sceneTags: normalizeList(input.sceneTags),
    notes: input.notes?.trim() || "",
    musicbrainzId,
    musicbrainzUrl,
    youtubeUrl,
    listenUrl,
    embedSourceKind,
    embedIframeUrl,
    creativeTvUrl,
    creativeTvPostId,
    livepeerPlaybackId: "",
    audioCid: "",
    audioUrl: "",
    durationSeconds: null,
    isCurated: false
  };
}

function parseLegacyTracks(value: string): Track[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is TrackInput => Boolean(item) && typeof item === "object")
      .map(normalizeTrack);
  } catch {
    return [];
  }
}

function fingerprintForTrack(track: Track): string {
  return [
    track.artist.toLowerCase(),
    track.title.toLowerCase(),
    track.releaseYear.toLowerCase()
  ].join("::");
}

function mapSong(row: SongRow): Track {
  const title = row.title;
  const artist = row.artist;
  const embedKindRaw = row.embed_source_kind?.trim() || "youtube";
  const embedSourceKind: EmbedSourceKind =
    embedKindRaw === "iframe_allowed" || embedKindRaw === "link_only" || embedKindRaw === "creativetv"
      ? embedKindRaw
      : "youtube";

  return {
    title,
    artist,
    releaseYear: row.release_year ?? "",
    duration: row.duration ?? "",
    bpm: row.bpm ?? "",
    energy: row.energy ?? "",
    moodTags: parseList(row.mood_tags),
    sceneTags: parseList(row.scene_tags),
    notes: row.notes ?? "",
    musicbrainzId: row.musicbrainz_id ?? "",
    musicbrainzUrl: row.musicbrainz_url?.trim() || buildMusicBrainzSearchUrl(title, artist),
    youtubeUrl: row.youtube_url ?? "",
    listenUrl: row.listen_url?.trim() || buildYoutubeSearchUrl(title, artist),
    embedSourceKind,
    embedIframeUrl: row.embed_iframe_url?.trim() ?? "",
    creativeTvUrl: row.creative_tv_url?.trim() ?? "",
    creativeTvPostId: row.creative_tv_post_id?.trim() ?? "",
    livepeerPlaybackId: row.livepeer_playback_id?.trim() ?? "",
    audioCid: row.audio_cid?.trim() ?? "",
    audioUrl: row.audio_url?.trim() ?? "",
    durationSeconds:
      typeof row.duration_seconds === "number" && Number.isFinite(row.duration_seconds)
        ? row.duration_seconds
        : null,
    isCurated: row.is_curated === 1
  };
}

function mapMixTrack(row: MixSongRow): MixTrack {
  return {
    songId: row.id,
    ...mapSong(row)
  };
}

function mapLibrarySong(row: SongListRow): Song {
  let mixIds: number[] = [];
  try {
    const parsed = JSON.parse(row.mix_ids) as unknown;
    if (Array.isArray(parsed)) {
      mixIds = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
    }
  } catch {
    mixIds = [];
  }

  return {
    id: row.id,
    mixCount: row.mix_count,
    mixIds,
    ...mapSong(row)
  };
}

async function listTracksForMix(mixId: number): Promise<MixTrack[]> {
  const rows = await sqlAll<MixSongRow>(
    `SELECT songs.*, mix_songs.position
     FROM mix_songs
     JOIN songs ON songs.id = mix_songs.song_id
     WHERE mix_songs.mix_id = ?
     ORDER BY mix_songs.position ASC, mix_songs.id ASC`,
    [mixId]
  );

  return rows.map(mapMixTrack);
}

async function mapMix(row: MixRow): Promise<Mix> {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    vibe: row.vibe ?? "",
    useCase: row.use_case ?? "",
    duration: row.duration ?? "",
    djPersona: row.dj_persona ?? "",
    coverTheme: row.cover_theme ?? "",
    shareNote: row.share_note ?? "",
    tags: parseList(row.tags),
    tracks: await listTracksForMix(row.id),
    creatorId: row.creator_id ?? null,
    isPublic: row.is_public === undefined || row.is_public === null ? true : row.is_public !== 0,
    slug: row.slug?.trim() ?? "",
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeMomentKind(value: unknown): MixMoment["kind"] {
  return value === "memory" || value === "set" || value === "discovery" ? value : "note";
}

function mapMixMoment(row: MixMomentRow): MixMoment {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    kind: normalizeMomentKind(row.kind),
    mixId: row.mix_id,
    mixTitle: row.mix_title ?? "",
    createdAt: row.created_at
  };
}



const UPSERT_SONG_SQL = `INSERT INTO songs (
    fingerprint, title, artist, musicbrainz_id, release_year, duration, bpm, energy, mood_tags, scene_tags, notes, musicbrainz_url, youtube_url, listen_url, embed_source_kind, embed_iframe_url, creative_tv_url, creative_tv_post_id
  ) VALUES (
    @fingerprint, @title, @artist, @musicbrainzId, @releaseYear, @duration, @bpm, @energy, @moodTags, @sceneTags, @notes, @musicbrainzUrl, @youtubeUrl, @listenUrl, @embedSourceKind, @embedIframeUrl, @creativeTvUrl, @creativeTvPostId
  )
  ON CONFLICT(fingerprint) DO UPDATE SET
    title = excluded.title,
    artist = excluded.artist,
    musicbrainz_id = COALESCE(excluded.musicbrainz_id, songs.musicbrainz_id),
    release_year = excluded.release_year,
    duration = excluded.duration,
    bpm = excluded.bpm,
    energy = excluded.energy,
    mood_tags = excluded.mood_tags,
    scene_tags = excluded.scene_tags,
    notes = excluded.notes,
    musicbrainz_url = excluded.musicbrainz_url,
    youtube_url = COALESCE(excluded.youtube_url, songs.youtube_url),
    listen_url = excluded.listen_url,
    embed_source_kind = excluded.embed_source_kind,
    embed_iframe_url = COALESCE(excluded.embed_iframe_url, songs.embed_iframe_url),
    creative_tv_url = COALESCE(excluded.creative_tv_url, songs.creative_tv_url),
    creative_tv_post_id = COALESCE(excluded.creative_tv_post_id, songs.creative_tv_post_id),
    updated_at = CURRENT_TIMESTAMP`;

const INSERT_MIX_SONG_SQL = `INSERT INTO mix_songs (mix_id, song_id, position)
     VALUES (@mixId, @songId, @position)`;

function upsertSongParams(track: Track): Record<string, unknown> {
  return {
    fingerprint: fingerprintForTrack(track),
    title: track.title,
    artist: track.artist,
    musicbrainzId: track.musicbrainzId,
    releaseYear: track.releaseYear,
    duration: track.duration,
    bpm: track.bpm,
    energy: track.energy,
    moodTags: JSON.stringify(track.moodTags),
    sceneTags: JSON.stringify(track.sceneTags),
    notes: track.notes,
    musicbrainzUrl: track.musicbrainzUrl,
    youtubeUrl: track.youtubeUrl,
    listenUrl: track.listenUrl,
    embedSourceKind: track.embedSourceKind,
    embedIframeUrl: track.embedIframeUrl,
    creativeTvUrl: track.creativeTvUrl,
    creativeTvPostId: track.creativeTvPostId
  };
}

function upsertSongSQLite(database: Database.Database, track: Track): number {
  database.prepare(UPSERT_SONG_SQL).run(upsertSongParams(track));
  const fingerprint = fingerprintForTrack(track);
  const row = database.prepare("SELECT id FROM songs WHERE fingerprint = ?").get(fingerprint) as { id: number } | undefined;
  if (!row) throw new Error("Could not persist song.");
  return row.id;
}

async function upsertSongTx(tx: Transaction, track: Track): Promise<number> {
  await txRun(tx, UPSERT_SONG_SQL, upsertSongParams(track));
  const fingerprint = fingerprintForTrack(track);
  const row = await txGet<{ id: number }>(tx, "SELECT id FROM songs WHERE fingerprint = ?", [fingerprint]);
  if (!row) throw new Error("Could not persist song.");
  return row.id;
}

async function upsertSong(track: Track): Promise<number> {
  await dbReady();
  if (useLibsql()) {
    await sqlRun(UPSERT_SONG_SQL, upsertSongParams(track));
    const fingerprint = fingerprintForTrack(track);
    const row = await sqlGet<{ id: number }>("SELECT id FROM songs WHERE fingerprint = ?", [fingerprint]);
    if (!row) throw new Error("Could not persist song.");
    return row.id;
  }
  return upsertSongSQLite(getSqliteDatabase(), track);
}

export async function syncCreativeTvPlaybackForSong(songId: number): Promise<Song | null> {
  const song = await getSong(songId);
  if (!song) return null;

  const postId = song.creativeTvPostId?.trim();
  if (!postId || !isCreativeTvConfigured()) return song;
  if (song.livepeerPlaybackId?.trim()) return song;

  try {
    const playback = await resolvePlaybackByAssetId(postId);
    await sqlRun(
      `UPDATE songs
       SET livepeer_playback_id = @playbackId,
           creative_tv_url = @creativeTvUrl,
           duration_seconds = COALESCE(@durationSeconds, duration_seconds),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`,
      {
        id: songId,
        playbackId: playback.playbackId,
        creativeTvUrl: playback.discoverUrl,
        durationSeconds: playback.durationSeconds ?? null
      }
    );
  } catch {
    // Keep discover URL; retry on next page load.
  }

  return await getSong(songId);
}

export async function ensureCreativeTvPlaybackForSong(songId: number): Promise<Song | null> {
  const song = await getSong(songId);
  if (!song) return null;
  if (song.livepeerPlaybackId?.trim()) return song;
  if (!song.creativeTvPostId?.trim()) return song;
  return syncCreativeTvPlaybackForSong(songId);
}

export async function setSongAdminAudio(
  id: number,
  input: { audioCid: string; audioUrl: string; durationSeconds?: number | null }
): Promise<Song | null> {
  const current = await getSong(id);
  if (!current) return null;

  await sqlRun(
    `UPDATE songs
     SET audio_cid = @audioCid,
         audio_url = @audioUrl,
         duration_seconds = @durationSeconds,
         is_curated = 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`,
    {
      id,
      audioCid: input.audioCid,
      audioUrl: input.audioUrl,
      durationSeconds: input.durationSeconds ?? current.durationSeconds
    }
  );

  return await getSong(id);
}

async function replaceMixSongs(mixId: number, tracks: Track[]): Promise<void> {
  const songIds: number[] = [];

  await withWriteTransaction({
    sqlite: () => {
      const database = getSqliteDatabase();
      database.transaction(() => {
        database.prepare("DELETE FROM mix_songs WHERE mix_id = ?").run(mixId);
        const insertMixSong = database.prepare(INSERT_MIX_SONG_SQL);
        for (const [index, track] of tracks.entries()) {
          const songId = upsertSongSQLite(database, track);
          songIds.push(songId);
          insertMixSong.run({
            mixId,
            songId,
            position: index + 1
          });
        }
      })();
    },
    libsql: async (tx) => {
      await txRun(tx, "DELETE FROM mix_songs WHERE mix_id = ?", [mixId]);
      for (const [index, track] of tracks.entries()) {
        const songId = await upsertSongTx(tx, track);
        songIds.push(songId);
        await txRun(tx, INSERT_MIX_SONG_SQL, {
          mixId,
          songId,
          position: index + 1
        });
      }
    }
  });

  for (const songId of songIds) {
    await syncCreativeTvPlaybackForSong(songId);
  }
}

async function migrateLegacyTracks(): Promise<void> {
  await dbReady();
  const legacyRows = await sqlAll<MixRow>(
    `SELECT mixes.*
     FROM mixes
     WHERE tracks <> '[]'
       AND NOT EXISTS (
         SELECT 1 FROM mix_songs WHERE mix_songs.mix_id = mixes.id
       )`
  );

  if (legacyRows.length === 0) return;

  for (const row of legacyRows) {
    await replaceMixSongs(row.id, parseLegacyTracks(row.tracks));
  }
}
function mixVisibilityClause(filter: MixListFilter = {}): { sql: string; params: Record<string, unknown> } {
  const parts: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.publicOnly) {
    parts.push("mixes.is_public = 1");
  } else if (filter.viewerCreatorId) {
    parts.push("(mixes.is_public = 1 OR mixes.creator_id = @viewerCreatorId)");
    params.viewerCreatorId = filter.viewerCreatorId;
  }
  const sql = parts.length > 0 ? parts.join(" AND ") : "1=1";
  return { sql, params };
}

function mixLimitClause(filter: MixListFilter): string {
  if (typeof filter.limit !== "number" || !Number.isFinite(filter.limit)) return "";
  const n = Math.min(Math.max(Math.floor(filter.limit), 1), 100);
  return ` LIMIT ${n}`;
}

export async function listMixes(query = "", filter: MixListFilter = {}): Promise<Mix[]> {
  await scheduleLegacyMixMigration();
  const search = query.trim();
  const vis = mixVisibilityClause(filter);

  const limitSql = mixLimitClause(filter);

  if (!search) {
    const rows = await sqlAll<MixRow>(
      `SELECT * FROM mixes WHERE ${vis.sql} ORDER BY updated_at DESC, id DESC${limitSql}`,
      vis.params
    );
    return Promise.all(rows.map((row) => mapMix(row)));
  }

  const like = `%${search}%`;
  const rows = await sqlAll<MixRow>(
    `SELECT DISTINCT mixes.*
       FROM mixes
       LEFT JOIN mix_songs ON mix_songs.mix_id = mixes.id
       LEFT JOIN songs ON songs.id = mix_songs.song_id
       WHERE (${vis.sql})
         AND (
           mixes.title LIKE @like
          OR mixes.description LIKE @like
          OR mixes.vibe LIKE @like
          OR mixes.use_case LIKE @like
          OR mixes.dj_persona LIKE @like
          OR mixes.cover_theme LIKE @like
          OR mixes.share_note LIKE @like
          OR mixes.tags LIKE @like
          OR songs.title LIKE @like
          OR songs.artist LIKE @like
          OR songs.energy LIKE @like
          OR songs.notes LIKE @like
          OR songs.mood_tags LIKE @like
          OR songs.scene_tags LIKE @like
         )
       ORDER BY mixes.updated_at DESC, mixes.id DESC${limitSql}`,
    { like, ...vis.params }
  );

  return Promise.all(rows.map((row) => mapMix(row)));
}

export async function getMixBySlug(slug: string): Promise<Mix | null> {
  await scheduleLegacyMixMigration();
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const row = await sqlGet<MixRow>(`SELECT * FROM mixes WHERE slug = ? COLLATE NOCASE`, [normalized]);
  return row ? await mapMix(row) : null;
}

export async function listSongs(query = "", limit = 12): Promise<Song[]> {
  await scheduleLegacyMixMigration();
  const search = query.trim();
  const baseQuery = `
    SELECT
      songs.*,
      COUNT(DISTINCT mix_songs.mix_id) AS mix_count,
      COALESCE(json_group_array(DISTINCT mix_songs.mix_id), '[]') AS mix_ids
    FROM songs
    LEFT JOIN mix_songs ON mix_songs.song_id = songs.id
  `;

  if (!search) {
    const rows = await sqlAll<SongListRow>(
      `${baseQuery}
         GROUP BY songs.id
         ORDER BY songs.updated_at DESC, songs.id DESC
         LIMIT ?`,
      [Math.min(Math.max(limit, 1), 50)]
    );
    return rows.map(mapLibrarySong);
  }

  const like = `%${search}%`;
  const rows = await sqlAll<SongListRow>(
    `${baseQuery}
       WHERE songs.title LIKE @like
          OR songs.artist LIKE @like
          OR songs.energy LIKE @like
          OR songs.notes LIKE @like
          OR songs.mood_tags LIKE @like
          OR songs.scene_tags LIKE @like
       GROUP BY songs.id
       ORDER BY songs.updated_at DESC, songs.id DESC
       LIMIT @limit`,
    { like, limit: Math.min(Math.max(limit, 1), 50) }
  );

  return rows.map(mapLibrarySong);
}

export async function getSong(id: number): Promise<Song | null> {
  await scheduleLegacyMixMigration();
  const row = await sqlGet<SongListRow>(
    `SELECT
        songs.*,
        COUNT(DISTINCT mix_songs.mix_id) AS mix_count,
        COALESCE(json_group_array(DISTINCT mix_songs.mix_id), '[]') AS mix_ids
       FROM songs
       LEFT JOIN mix_songs ON mix_songs.song_id = songs.id
       WHERE songs.id = ?
       GROUP BY songs.id`,
    [id]
  );

  return row ? mapLibrarySong(row) : null;
}

export async function createSong(input: SongInput): Promise<Song> {
  await scheduleLegacyMixMigration();
  const track = normalizeTrack(input);
  const songId = await upsertSong(track);
  return (await syncCreativeTvPlaybackForSong(songId)) as Song;
}

export async function updateSong(id: number, input: Partial<SongInput>): Promise<Song | null> {
  await scheduleLegacyMixMigration();
  const current = await getSong(id);
  if (!current) return null;

  const next = normalizeTrack({
    title: input.title?.trim() || current.title,
    artist: input.artist?.trim() || current.artist,
    releaseYear: input.releaseYear?.trim() ?? current.releaseYear,
    duration: input.duration?.trim() ?? current.duration,
    bpm: input.bpm?.trim() ?? current.bpm,
    energy: input.energy?.trim() ?? current.energy,
    moodTags: input.moodTags ?? current.moodTags,
    sceneTags: input.sceneTags ?? current.sceneTags,
    notes: input.notes?.trim() ?? current.notes,
    musicbrainzId: input.musicbrainzId?.trim() ?? current.musicbrainzId,
    musicbrainzUrl: input.musicbrainzUrl?.trim() ?? current.musicbrainzUrl,
    youtubeUrl: input.youtubeUrl?.trim() ?? current.youtubeUrl,
    listenUrl: input.listenUrl?.trim() ?? current.listenUrl,
    embedSourceKind: input.embedSourceKind ?? current.embedSourceKind,
    embedIframeUrl: input.embedIframeUrl?.trim() ?? current.embedIframeUrl,
    creativeTvUrl: input.creativeTvUrl?.trim() ?? current.creativeTvUrl
  });

  await sqlRun(
    `UPDATE songs
     SET title = @title,
         artist = @artist,
         musicbrainz_id = @musicbrainzId,
         release_year = @releaseYear,
         duration = @duration,
         bpm = @bpm,
         energy = @energy,
         mood_tags = @moodTags,
         scene_tags = @sceneTags,
         notes = @notes,
         musicbrainz_url = @musicbrainzUrl,
         youtube_url = @youtubeUrl,
         listen_url = @listenUrl,
         embed_source_kind = @embedSourceKind,
         embed_iframe_url = @embedIframeUrl,
         creative_tv_url = @creativeTvUrl,
         creative_tv_post_id = @creativeTvPostId,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`,
    {
      id,
      title: next.title,
      artist: next.artist,
      musicbrainzId: next.musicbrainzId,
      releaseYear: next.releaseYear,
      duration: next.duration,
      bpm: next.bpm,
      energy: next.energy,
      moodTags: JSON.stringify(next.moodTags),
      sceneTags: JSON.stringify(next.sceneTags),
      notes: next.notes,
      musicbrainzUrl: next.musicbrainzUrl,
      youtubeUrl: next.youtubeUrl,
      listenUrl: next.listenUrl,
      embedSourceKind: next.embedSourceKind,
      embedIframeUrl: next.embedIframeUrl,
      creativeTvUrl: next.creativeTvUrl,
      creativeTvPostId: next.creativeTvPostId
    }
  );

  if (next.creativeTvPostId && next.creativeTvPostId !== current.creativeTvPostId) {
    await sqlRun(`UPDATE songs SET livepeer_playback_id = NULL WHERE id = ?`, [id]);
  }

  return (await syncCreativeTvPlaybackForSong(id)) as Song | null;
}

export async function addSongToMix(
  mixId: number,
  input: { songId?: number; position?: number; song?: SongInput }
): Promise<Mix | null> {
  await scheduleLegacyMixMigration();
  const mix = await getMix(mixId);
  if (!mix) return null;

  const resolvedSongId =
    typeof input.songId === "number" && Number.isFinite(input.songId)
      ? input.songId
      : input.song
        ? (await createSong(input.song)).id
        : null;

  if (!resolvedSongId) {
    throw new Error("Provide either `songId` or `song` when adding to a mix.");
  }

  const targetSong = await getSong(resolvedSongId);
  if (!targetSong) {
    throw new Error("Song not found.");
  }

  const currentCountRow = await sqlGet<{ max_position: number }>(
    "SELECT COALESCE(MAX(position), 0) AS max_position FROM mix_songs WHERE mix_id = ?",
    [mixId]
  );

  const requestedPosition =
    typeof input.position === "number" && Number.isFinite(input.position)
      ? Math.max(1, Math.floor(input.position))
      : (currentCountRow?.max_position ?? 0) + 1;

  await withWriteTransaction({
    sqlite: () => {
      const database = getSqliteDatabase();
      database.transaction(() => {
        database
          .prepare(
            `UPDATE mix_songs
       SET position = position + 1
       WHERE mix_id = @mixId AND position >= @position`
          )
          .run({
            mixId,
            position: requestedPosition
          });

        database
          .prepare(
            `INSERT INTO mix_songs (mix_id, song_id, position)
       VALUES (@mixId, @songId, @position)`
          )
          .run({
            mixId,
            songId: targetSong.id,
            position: requestedPosition
          });

        database.prepare("UPDATE mixes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(mixId);
      })();
    },
    libsql: async (tx) => {
      await txRun(tx, `UPDATE mix_songs SET position = position + 1 WHERE mix_id = @mixId AND position >= @position`, {
        mixId,
        position: requestedPosition
      });

      await txRun(tx, `INSERT INTO mix_songs (mix_id, song_id, position) VALUES (@mixId, @songId, @position)`, {
        mixId,
        songId: targetSong.id,
        position: requestedPosition
      });

      await txRun(tx, "UPDATE mixes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [mixId]);
    }
  });

  return await getMix(mixId);
}

type EnrichSongInput = {
  musicbrainzId?: string;
  musicbrainzUrl?: string;
  youtubeUrl?: string;
  title?: string;
  artist?: string;
  releaseYear?: string;
};

export async function enrichSongFromMusicBrainz(id: number, input: EnrichSongInput = {}): Promise<Song | null> {
  const current = await getSong(id);
  if (!current) return null;

  const hasCanonicalMusicBrainzLink =
    current.musicbrainzUrl.includes("musicbrainz.org/recording/") || current.musicbrainzUrl.includes("musicbrainz.org/release/");

  let next = {
    musicbrainzId: input.musicbrainzId?.trim() || current.musicbrainzId,
    musicbrainzUrl: input.musicbrainzUrl?.trim() || (hasCanonicalMusicBrainzLink ? current.musicbrainzUrl : ""),
    youtubeUrl: input.youtubeUrl?.trim() || current.youtubeUrl,
    releaseYear: input.releaseYear?.trim() || current.releaseYear,
    title: input.title?.trim() || current.title,
    artist: input.artist?.trim() || current.artist
  };

  if (!next.musicbrainzId && !next.musicbrainzUrl) {
    const result = await searchMusicBrainzRecordings({
      title: current.title,
      artist: current.artist,
      limit: 1
    });
    const match = result.recordings[0];
    if (!match) return current;

    next = {
      musicbrainzId: match.id,
      musicbrainzUrl: match.url,
      youtubeUrl: current.youtubeUrl,
      releaseYear: match.firstReleaseDate ? match.firstReleaseDate.slice(0, 4) : current.releaseYear,
      title: current.title,
      artist: current.artist
    };
  }

  await sqlRun(
    `UPDATE songs
     SET musicbrainz_id = @musicbrainzId,
         musicbrainz_url = @musicbrainzUrl,
         youtube_url = @youtubeUrl,
         release_year = CASE
           WHEN @releaseYear <> '' THEN @releaseYear
           ELSE release_year
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`,
    {
      id,
      musicbrainzId: next.musicbrainzId,
      musicbrainzUrl: next.musicbrainzUrl,
      youtubeUrl: next.youtubeUrl,
      releaseYear: next.releaseYear
    }
  );

  return await getSong(id);
}

export async function getMix(id: number): Promise<Mix | null> {
  await scheduleLegacyMixMigration();
  const row = await sqlGet<MixRow>("SELECT * FROM mixes WHERE id = ?", [id]);
  return row ? await mapMix(row) : null;
}

export async function createMix(input: MixInput): Promise<Mix> {
  await scheduleLegacyMixMigration();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const tracks = (input.tracks ?? []).map(normalizeTrack);
  const slug = input.slug?.trim()
    ? slugifyMixTitle(input.slug)
    : await ensureUniqueMixSlug(title);
  const isPublic = input.isPublic === undefined ? true : Boolean(input.isPublic);
  const publishedAt = input.publish === false ? null : new Date().toISOString();

  const result = await sqlRun(
    `INSERT INTO mixes (
        title, description, vibe, use_case, duration, dj_persona, cover_theme, share_note, tags, tracks,
        is_public, slug, published_at, creator_id
      ) VALUES (
        @title, @description, @vibe, @useCase, @duration, @djPersona, @coverTheme, @shareNote, @tags, '[]',
        @isPublic, @slug, @publishedAt, @creatorId
      )`,
    {
      title,
      description: input.description?.trim() || "",
      vibe: input.vibe?.trim() || "",
      useCase: input.useCase?.trim() || "",
      duration: input.duration?.trim() || "",
      djPersona: input.djPersona?.trim() || "",
      coverTheme: input.coverTheme?.trim() || "",
      shareNote: input.shareNote?.trim() || "",
      tags: JSON.stringify(normalizeList(input.tags)),
      isPublic: isPublic ? 1 : 0,
      slug,
      publishedAt,
      creatorId: input.creatorId ?? null
    }
  );

  const mixId = Number(result.lastInsertRowid);
  await replaceMixSongs(mixId, tracks);
  return (await getMix(mixId)) as Mix;
}

export async function updateMix(id: number, input: Partial<MixInput>): Promise<Mix | null> {
  await scheduleLegacyMixMigration();
  const current = await getMix(id);
  if (!current) return null;

  const nextTracks = input.tracks ? input.tracks.map(normalizeTrack) : current.tracks;
  let slug = current.slug;
  if (input.slug !== undefined) {
    slug = input.slug.trim() ? slugifyMixTitle(input.slug) : "";
  }
  if (!slug && input.title?.trim()) {
    slug = await ensureUniqueMixSlug(input.title.trim(), id);
  } else if (slug) {
    const taken = await sqlGet<{ id: number }>(
      `SELECT id FROM mixes WHERE slug = ? COLLATE NOCASE AND id <> ?`,
      [slug, id]
    );
    if (taken) slug = await ensureUniqueMixSlug(slug, id);
  }

  const isPublic = input.isPublic === undefined ? current.isPublic : Boolean(input.isPublic);
  let publishedAt = current.publishedAt;
  if (input.publish === true) {
    publishedAt = new Date().toISOString();
  } else if (input.publish === false) {
    publishedAt = null;
  }

  const next = {
    title: input.title?.trim() || current.title,
    description: input.description?.trim() ?? current.description,
    vibe: input.vibe?.trim() ?? current.vibe,
    useCase: input.useCase?.trim() ?? current.useCase,
    duration: input.duration?.trim() ?? current.duration,
    djPersona: input.djPersona?.trim() ?? current.djPersona,
    coverTheme: input.coverTheme?.trim() ?? current.coverTheme,
    shareNote: input.shareNote?.trim() ?? current.shareNote,
    tags: JSON.stringify(input.tags ? normalizeList(input.tags) : current.tags),
    isPublic: isPublic ? 1 : 0,
    slug: slug || null,
    publishedAt,
    creatorId: input.creatorId === undefined ? current.creatorId : input.creatorId,
    id
  };

  await sqlRun(
    `UPDATE mixes
     SET title = @title,
         description = @description,
         vibe = @vibe,
         use_case = @useCase,
         duration = @duration,
         dj_persona = @djPersona,
         cover_theme = @coverTheme,
         share_note = @shareNote,
         tags = @tags,
         is_public = @isPublic,
         slug = @slug,
         published_at = @publishedAt,
         creator_id = @creatorId,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`,
    next
  );

  await replaceMixSongs(id, nextTracks);
  return await getMix(id);
}

export async function removeSongFromMix(mixId: number, position: number): Promise<Mix | null> {
  await scheduleLegacyMixMigration();
  const mix = await getMix(mixId);
  if (!mix) return null;
  const pos = Math.max(1, Math.floor(position));

  await withWriteTransaction({
    sqlite: () => {
      const database = getSqliteDatabase();
      database.transaction(() => {
        database.prepare("DELETE FROM mix_songs WHERE mix_id = ? AND position = ?").run(mixId, pos);
        database
          .prepare(
            `UPDATE mix_songs SET position = position - 1 WHERE mix_id = ? AND position > ?`
          )
          .run(mixId, pos);
        database.prepare("UPDATE mixes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(mixId);
      })();
    },
    libsql: async (tx) => {
      await txRun(tx, "DELETE FROM mix_songs WHERE mix_id = ? AND position = ?", [mixId, pos]);
      await txRun(tx, `UPDATE mix_songs SET position = position - 1 WHERE mix_id = ? AND position > ?`, [
        mixId,
        pos
      ]);
      await txRun(tx, "UPDATE mixes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [mixId]);
    }
  });

  return await getMix(mixId);
}

export async function reorderMixTracks(mixId: number, positions: number[]): Promise<Mix | null> {
  await scheduleLegacyMixMigration();
  const mix = await getMix(mixId);
  if (!mix) return null;
  if (positions.length !== mix.tracks.length) {
    throw new Error("Track order must include every position exactly once.");
  }
  const expected = new Set(mix.tracks.map((_, index) => index + 1));
  if (!positions.every((p) => expected.has(p)) || new Set(positions).size !== positions.length) {
    throw new Error("Track order must include every position exactly once.");
  }

  const reordered = positions.map((position) => mix.tracks[position - 1]);
  await replaceMixSongs(mixId, reordered);
  return await getMix(mixId);
}

export async function deleteMix(id: number): Promise<boolean> {
  await scheduleLegacyMixMigration();
  await sqlRun("DELETE FROM mix_songs WHERE mix_id = ?", [id]);
  const result = await sqlRun("DELETE FROM mixes WHERE id = ?", [id]);
  return result.changes > 0;
}

export async function listMixMoments(limit = 25): Promise<MixMoment[]> {
  await scheduleLegacyMixMigration();
  const rows = await sqlAll<MixMomentRow>(
    `SELECT mix_moments.*, mixes.title AS mix_title
       FROM mix_moments
       LEFT JOIN mixes ON mixes.id = mix_moments.mix_id
       ORDER BY mix_moments.created_at DESC, mix_moments.id DESC
       LIMIT ?`,
    [Math.min(Math.max(limit, 1), 100)]
  );

  return rows.map(mapMixMoment);
}

export async function createMixMoment(input: MixMomentInput): Promise<MixMoment> {
  await scheduleLegacyMixMigration();
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const result = await sqlRun(
    `INSERT INTO mix_moments (title, body, kind, mix_id)
       VALUES (@title, @body, @kind, @mixId)`,
    {
      title,
      body: input.body?.trim() || "",
      kind: normalizeMomentKind(input.kind),
      mixId: input.mixId ?? null
    }
  );

  const moments = await listMixMoments(100);
  return moments.find((moment) => moment.id === Number(result.lastInsertRowid)) as MixMoment;
}

export async function seedMixes(): Promise<Mix[]> {
  if ((await listMixes()).length > 0) {
    await seedMixMoments();
    return await listMixes();
  }

  const mix = await createMix({
    title: "Neon Rooftop Warm-Up",
    description: "A retro house-and-leftfield opener that starts conversational, then lifts into a loose rooftop glide.",
    vibe: "warm-up to lift-off",
    useCase: "house party first hour",
    duration: "38 min",
    djPersona: "Velvet Static",
    coverTheme: "chrome cassette / pink grid",
    shareNote: "Share as a public tape page with outbound links for each track. Good for sunset arrivals and first drinks.",
    tags: ["party", "retro", "balearic", "warm-up"],
    tracks: [
      {
        title: "Music Sounds Better With You",
        artist: "Stardust",
        releaseYear: "1998",
        duration: "6:43",
        bpm: "124",
        energy: "glow",
        moodTags: ["euphoric", "friendly"],
        sceneTags: ["sunset", "arrival"],
        notes: "Sets an immediate social tone without peaking too early.",
        musicbrainzUrl: "https://musicbrainz.org/search?query=Music+Sounds+Better+With+You+Stardust&type=recording&method=indexed",
        listenUrl: "https://www.youtube.com/results?search_query=Music+Sounds+Better+With+You+Stardust"
      },
      {
        title: "Teardrop",
        artist: "Massive Attack",
        releaseYear: "1998",
        duration: "5:31",
        bpm: "76",
        energy: "float",
        moodTags: ["dreamy", "late-night"],
        sceneTags: ["reset", "breather"],
        notes: "A left turn that gives the mix shape instead of flat tempo loyalty.",
        musicbrainzUrl: "https://musicbrainz.org/search?query=Teardrop+Massive+Attack&type=recording&method=indexed",
        listenUrl: "https://www.youtube.com/results?search_query=Teardrop+Massive+Attack"
      },
      {
        title: "Praise You",
        artist: "Fatboy Slim",
        releaseYear: "1998",
        duration: "5:24",
        bpm: "138",
        energy: "lift",
        moodTags: ["cheeky", "anthemic"],
        sceneTags: ["crowd-open", "singalong"],
        notes: "This is where the room stops leaning and starts moving.",
        musicbrainzUrl: "https://musicbrainz.org/search?query=Praise+You+Fatboy+Slim&type=recording&method=indexed",
        listenUrl: "https://www.youtube.com/results?search_query=Praise+You+Fatboy+Slim"
      }
    ]
  });

  await seedMixMoments(mix.id);
  return await listMixes();
}

export async function seedMixMoments(mixId?: number): Promise<MixMoment[]> {
  if ((await listMixMoments(1)).length > 0) return await listMixMoments();

  await createMixMoment({
    title: "Captured a rooftop warm-up arc",
    body: "The target arc starts social and patient, then widens into recognizable hooks once the room is full.",
    kind: "set",
    mixId: mixId ?? (await listMixes())[0]?.id ?? null
  });

  await createMixMoment({
    title: "User asked for a retro AI DJ persona",
    body: "Default to a lightly theatrical host voice, but keep recommendations grounded in actual event pacing.",
    kind: "memory"
  });

  await createMixMoment({
    title: "Phase one sourcing rule",
    body: "Store metadata and legal outbound links only. Avoid direct download or audio hosting workflows in the first release.",
    kind: "note"
  });

  return await listMixMoments();
}
