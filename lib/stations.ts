import "./mixtapes";
import { db } from "./db";

export type Creator = {
  id: number;
  walletAddress: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  ttsProvider: string;
  ttsVoiceId: string;
  createdAt: string;
};

export type Station = {
  id: number;
  creatorId: number;
  handle: string;
  name: string;
  tagline: string;
  coverUrl: string;
  seedMixId: number | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SegmentKind = "music" | "voice" | "upload" | "text" | "podcast";

export type Segment = {
  id: number;
  stationId: number;
  position: number;
  kind: SegmentKind;
  title: string;
  body: string;
  songId: number | null;
  audioCid: string;
  audioUrl: string;
  durationSeconds: number | null;
  podcastEpisodeId: number | null;
  ttsVoice: string;
  ttsProvider: string;
  publishedAt: string;
  createdAt: string;
};

export type PodcastFeed = {
  id: number;
  stationId: number;
  feedUrl: string;
  title: string;
  lastRefreshedAt: string | null;
};

export type PodcastEpisode = {
  id: number;
  feedId: number;
  guid: string;
  title: string;
  audioUrl: string;
  publishedAt: string | null;
  durationSeconds: number | null;
};

export type VoiceClone = {
  id: number;
  creatorId: number;
  provider: string;
  externalVoiceId: string;
  displayName: string;
  sourceCid: string;
  status: "PENDING" | "ACTIVE" | "FAILED";
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS creators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    tts_provider TEXT,
    tts_voice_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    tagline TEXT,
    cover_url TEXT,
    seed_mix_id INTEGER,
    is_public INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES creators(id) ON DELETE CASCADE,
    FOREIGN KEY(seed_mix_id) REFERENCES mixes(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS podcast_feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    feed_url TEXT NOT NULL,
    title TEXT,
    last_refreshed_at TEXT,
    UNIQUE(station_id, feed_url),
    FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS podcast_episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL,
    guid TEXT NOT NULL,
    title TEXT,
    audio_url TEXT NOT NULL,
    published_at TEXT,
    duration_seconds INTEGER,
    UNIQUE(feed_id, guid),
    FOREIGN KEY(feed_id) REFERENCES podcast_feeds(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('music','voice','upload','text','podcast')),
    title TEXT,
    body TEXT,
    song_id INTEGER,
    audio_cid TEXT,
    audio_url TEXT,
    duration_seconds INTEGER,
    podcast_episode_id INTEGER,
    tts_voice TEXT,
    tts_provider TEXT,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE,
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE SET NULL,
    FOREIGN KEY(podcast_episode_id) REFERENCES podcast_episodes(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_segments_station_pos ON segments(station_id, position);

  CREATE TABLE IF NOT EXISTS voice_clones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    external_voice_id TEXT NOT NULL,
    display_name TEXT,
    source_cid TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(creator_id, provider, external_voice_id),
    FOREIGN KEY(creator_id) REFERENCES creators(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS siwe_nonces (
    nonce TEXT PRIMARY KEY,
    issued_at INTEGER NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    creator_id INTEGER NOT NULL,
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(creator_id) REFERENCES creators(id) ON DELETE CASCADE
  );
`);

try {
  db.exec(`ALTER TABLE mix_moments ADD COLUMN segment_id INTEGER`);
} catch {
  // already added
}

function voiceClonesNeedsProviderUniqueMigration(): boolean {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'voice_clones'`)
    .get() as { sql?: string } | undefined;
  const sql = row?.sql ?? "";
  // Old schema: UNIQUE(provider, external_voice_id). New: UNIQUE(creator_id, provider, external_voice_id).
  return sql.includes("UNIQUE(provider, external_voice_id)") && !sql.includes("UNIQUE(creator_id,");
}

// `next build` loads this module in parallel workers; two DEFERRED migrations can interleave and break
// (e.g. one renames voice_clones_new away while another still INSERTs). BEGIN IMMEDIATE serializes writers.
const runVoiceCloneMigration = db
  .transaction(() => {
    if (!voiceClonesNeedsProviderUniqueMigration()) return;
    db.exec(`
    CREATE TABLE IF NOT EXISTS voice_clones_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      external_voice_id TEXT NOT NULL,
      display_name TEXT,
      source_cid TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(creator_id, provider, external_voice_id),
      FOREIGN KEY(creator_id) REFERENCES creators(id) ON DELETE CASCADE
    );
    INSERT OR IGNORE INTO voice_clones_new
      (id, creator_id, provider, external_voice_id, display_name, source_cid, status, created_at)
    SELECT id, creator_id, provider, external_voice_id, display_name, source_cid, status, created_at
    FROM voice_clones;
    DROP TABLE voice_clones;
    ALTER TABLE voice_clones_new RENAME TO voice_clones;
  `);
  })
  .immediate;

try {
  runVoiceCloneMigration();
} catch (error) {
  // Another worker may have finished migrating first; only rethrow if we're still on the old schema.
  if (voiceClonesNeedsProviderUniqueMigration()) throw error;
}

type CreatorRow = {
  id: number;
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  tts_provider: string | null;
  tts_voice_id: string | null;
  created_at: string;
};

type StationRow = {
  id: number;
  creator_id: number;
  handle: string;
  name: string;
  tagline: string | null;
  cover_url: string | null;
  seed_mix_id: number | null;
  is_public: number;
  created_at: string;
  updated_at: string;
};

type SegmentRow = {
  id: number;
  station_id: number;
  position: number;
  kind: SegmentKind;
  title: string | null;
  body: string | null;
  song_id: number | null;
  audio_cid: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  podcast_episode_id: number | null;
  tts_voice: string | null;
  tts_provider: string | null;
  published_at: string;
  created_at: string;
};

type PodcastFeedRow = {
  id: number;
  station_id: number;
  feed_url: string;
  title: string | null;
  last_refreshed_at: string | null;
};

type PodcastEpisodeRow = {
  id: number;
  feed_id: number;
  guid: string;
  title: string | null;
  audio_url: string;
  published_at: string | null;
  duration_seconds: number | null;
};

type VoiceCloneRow = {
  id: number;
  creator_id: number;
  provider: string;
  external_voice_id: string;
  display_name: string | null;
  source_cid: string | null;
  status: "PENDING" | "ACTIVE" | "FAILED";
  created_at: string;
};

function mapCreator(row: CreatorRow): Creator {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    displayName: row.display_name ?? "",
    avatarUrl: row.avatar_url ?? "",
    bio: row.bio ?? "",
    ttsProvider: row.tts_provider ?? "",
    ttsVoiceId: row.tts_voice_id ?? "",
    createdAt: row.created_at
  };
}

function mapStation(row: StationRow): Station {
  return {
    id: row.id,
    creatorId: row.creator_id,
    handle: row.handle,
    name: row.name,
    tagline: row.tagline ?? "",
    coverUrl: row.cover_url ?? "",
    seedMixId: row.seed_mix_id,
    isPublic: row.is_public !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSegment(row: SegmentRow): Segment {
  return {
    id: row.id,
    stationId: row.station_id,
    position: row.position,
    kind: row.kind,
    title: row.title ?? "",
    body: row.body ?? "",
    songId: row.song_id,
    audioCid: row.audio_cid ?? "",
    audioUrl: row.audio_url ?? "",
    durationSeconds: row.duration_seconds,
    podcastEpisodeId: row.podcast_episode_id,
    ttsVoice: row.tts_voice ?? "",
    ttsProvider: row.tts_provider ?? "",
    publishedAt: row.published_at,
    createdAt: row.created_at
  };
}

function mapFeed(row: PodcastFeedRow): PodcastFeed {
  return {
    id: row.id,
    stationId: row.station_id,
    feedUrl: row.feed_url,
    title: row.title ?? "",
    lastRefreshedAt: row.last_refreshed_at
  };
}

function mapEpisode(row: PodcastEpisodeRow): PodcastEpisode {
  return {
    id: row.id,
    feedId: row.feed_id,
    guid: row.guid,
    title: row.title ?? "",
    audioUrl: row.audio_url,
    publishedAt: row.published_at,
    durationSeconds: row.duration_seconds
  };
}

function mapVoiceClone(row: VoiceCloneRow): VoiceClone {
  return {
    id: row.id,
    creatorId: row.creator_id,
    provider: row.provider,
    externalVoiceId: row.external_voice_id,
    displayName: row.display_name ?? "",
    sourceCid: row.source_cid ?? "",
    status: row.status,
    createdAt: row.created_at
  };
}

export function upsertCreatorByWallet(walletAddress: string): Creator {
  const normalized = walletAddress.toLowerCase();
  db.prepare(
    `INSERT INTO creators (wallet_address)
     VALUES (?)
     ON CONFLICT(wallet_address) DO NOTHING`
  ).run(normalized);
  const row = db.prepare(`SELECT * FROM creators WHERE wallet_address = ? COLLATE NOCASE`).get(normalized) as CreatorRow;
  return mapCreator(row);
}

export function getCreator(id: number): Creator | null {
  const row = db.prepare(`SELECT * FROM creators WHERE id = ?`).get(id) as CreatorRow | undefined;
  return row ? mapCreator(row) : null;
}

export function getCreatorByWallet(walletAddress: string): Creator | null {
  const row = db
    .prepare(`SELECT * FROM creators WHERE wallet_address = ? COLLATE NOCASE`)
    .get(walletAddress) as CreatorRow | undefined;
  return row ? mapCreator(row) : null;
}

export function updateCreator(
  id: number,
  patch: { displayName?: string; avatarUrl?: string; bio?: string; ttsProvider?: string; ttsVoiceId?: string }
): Creator | null {
  const current = getCreator(id);
  if (!current) return null;
  db.prepare(
    `UPDATE creators
     SET display_name = @displayName,
         avatar_url = @avatarUrl,
         bio = @bio,
         tts_provider = @ttsProvider,
         tts_voice_id = @ttsVoiceId
     WHERE id = @id`
  ).run({
    id,
    displayName: patch.displayName ?? current.displayName,
    avatarUrl: patch.avatarUrl ?? current.avatarUrl,
    bio: patch.bio ?? current.bio,
    ttsProvider: patch.ttsProvider ?? current.ttsProvider,
    ttsVoiceId: patch.ttsVoiceId ?? current.ttsVoiceId
  });
  return getCreator(id);
}

const handleRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function createStation(input: {
  creatorId: number;
  handle: string;
  name: string;
  tagline?: string;
  coverUrl?: string;
  seedMixId?: number | null;
}): Station {
  const handle = input.handle.trim().toLowerCase();
  if (!handleRegex.test(handle)) {
    throw new Error("Handle must be 3–32 chars, lowercase letters/digits/hyphens.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const result = db
    .prepare(
      `INSERT INTO stations (creator_id, handle, name, tagline, cover_url, seed_mix_id)
       VALUES (@creatorId, @handle, @name, @tagline, @coverUrl, @seedMixId)`
    )
    .run({
      creatorId: input.creatorId,
      handle,
      name,
      tagline: input.tagline?.trim() ?? "",
      coverUrl: input.coverUrl?.trim() ?? "",
      seedMixId: input.seedMixId ?? null
    });
  return getStation(Number(result.lastInsertRowid)) as Station;
}

export function getStation(id: number): Station | null {
  const row = db.prepare(`SELECT * FROM stations WHERE id = ?`).get(id) as StationRow | undefined;
  return row ? mapStation(row) : null;
}

export function getStationByHandle(handle: string): Station | null {
  const row = db
    .prepare(`SELECT * FROM stations WHERE handle = ? COLLATE NOCASE`)
    .get(handle) as StationRow | undefined;
  return row ? mapStation(row) : null;
}

export function listStations(filter: { creatorId?: number; publicOnly?: boolean } = {}): Station[] {
  const wheres: string[] = [];
  const params: Record<string, unknown> = {};
  if (typeof filter.creatorId === "number") {
    wheres.push("creator_id = @creatorId");
    params.creatorId = filter.creatorId;
  }
  if (filter.publicOnly) {
    wheres.push("is_public = 1");
  }
  const where = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM stations ${where} ORDER BY updated_at DESC, id DESC`)
    .all(params) as StationRow[];
  return rows.map(mapStation);
}

export function updateStation(
  id: number,
  patch: { name?: string; tagline?: string; coverUrl?: string; isPublic?: boolean; seedMixId?: number | null }
): Station | null {
  const current = getStation(id);
  if (!current) return null;
  db.prepare(
    `UPDATE stations
     SET name = @name,
         tagline = @tagline,
         cover_url = @coverUrl,
         is_public = @isPublic,
         seed_mix_id = @seedMixId,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run({
    id,
    name: patch.name?.trim() || current.name,
    tagline: patch.tagline ?? current.tagline,
    coverUrl: patch.coverUrl ?? current.coverUrl,
    isPublic: patch.isPublic === undefined ? (current.isPublic ? 1 : 0) : patch.isPublic ? 1 : 0,
    seedMixId: patch.seedMixId === undefined ? current.seedMixId : patch.seedMixId
  });
  return getStation(id);
}

export function deleteStation(id: number): boolean {
  const result = db.prepare(`DELETE FROM stations WHERE id = ?`).run(id);
  return result.changes > 0;
}

function nextSegmentPosition(stationId: number): number {
  const row = db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS max_position FROM segments WHERE station_id = ?`)
    .get(stationId) as { max_position: number };
  return row.max_position + 1;
}

export function listStationSegments(stationId: number): Segment[] {
  const rows = db
    .prepare(`SELECT * FROM segments WHERE station_id = ? ORDER BY position ASC, id ASC`)
    .all(stationId) as SegmentRow[];
  return rows.map(mapSegment);
}

export function getSegment(id: number): Segment | null {
  const row = db.prepare(`SELECT * FROM segments WHERE id = ?`).get(id) as SegmentRow | undefined;
  return row ? mapSegment(row) : null;
}

export function addSegment(input: {
  stationId: number;
  kind: SegmentKind;
  title?: string;
  body?: string;
  songId?: number | null;
  audioCid?: string;
  audioUrl?: string;
  durationSeconds?: number | null;
  podcastEpisodeId?: number | null;
  ttsVoice?: string;
  ttsProvider?: string;
  position?: number;
}): Segment {
  if (!getStation(input.stationId)) throw new Error("Station not found.");
  const position =
    typeof input.position === "number" && Number.isFinite(input.position)
      ? Math.max(1, Math.floor(input.position))
      : nextSegmentPosition(input.stationId);

  const insert = db.transaction(() => {
    if (typeof input.position === "number") {
      db.prepare(
        `UPDATE segments SET position = position + 1
         WHERE station_id = @stationId AND position >= @position`
      ).run({ stationId: input.stationId, position });
    }
    db.prepare(
      `INSERT INTO segments (
        station_id, position, kind, title, body, song_id, audio_cid, audio_url,
        duration_seconds, podcast_episode_id, tts_voice, tts_provider
      ) VALUES (
        @stationId, @position, @kind, @title, @body, @songId, @audioCid, @audioUrl,
        @durationSeconds, @podcastEpisodeId, @ttsVoice, @ttsProvider
      )`
    ).run({
      stationId: input.stationId,
      position,
      kind: input.kind,
      title: input.title ?? "",
      body: input.body ?? "",
      songId: input.songId ?? null,
      audioCid: input.audioCid ?? "",
      audioUrl: input.audioUrl ?? "",
      durationSeconds: input.durationSeconds ?? null,
      podcastEpisodeId: input.podcastEpisodeId ?? null,
      ttsVoice: input.ttsVoice ?? "",
      ttsProvider: input.ttsProvider ?? ""
    });
    db.prepare(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(input.stationId);
  });
  insert();

  const row = db
    .prepare(
      `SELECT * FROM segments WHERE station_id = ? AND position = ? ORDER BY id DESC LIMIT 1`
    )
    .get(input.stationId, position) as SegmentRow;
  return mapSegment(row);
}

export function updateSegment(
  id: number,
  patch: Partial<{
    title: string;
    body: string;
    audioCid: string;
    audioUrl: string;
    durationSeconds: number | null;
    ttsVoice: string;
    ttsProvider: string;
  }>
): Segment | null {
  const current = getSegment(id);
  if (!current) return null;
  db.prepare(
    `UPDATE segments
     SET title = @title,
         body = @body,
         audio_cid = @audioCid,
         audio_url = @audioUrl,
         duration_seconds = @durationSeconds,
         tts_voice = @ttsVoice,
         tts_provider = @ttsProvider
     WHERE id = @id`
  ).run({
    id,
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    audioCid: patch.audioCid ?? current.audioCid,
    audioUrl: patch.audioUrl ?? current.audioUrl,
    durationSeconds: patch.durationSeconds === undefined ? current.durationSeconds : patch.durationSeconds,
    ttsVoice: patch.ttsVoice ?? current.ttsVoice,
    ttsProvider: patch.ttsProvider ?? current.ttsProvider
  });
  db.prepare(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(current.stationId);
  return getSegment(id);
}

export function deleteSegment(id: number): boolean {
  const current = getSegment(id);
  if (!current) return false;
  const result = db.prepare(`DELETE FROM segments WHERE id = ?`).run(id);
  if (result.changes > 0) {
    db.prepare(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(current.stationId);
  }
  return result.changes > 0;
}

export function reorderSegments(stationId: number, orderedIds: number[]): Segment[] {
  if (orderedIds.length === 0 || new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("Segment order must include each station segment exactly once.");
  }
  const existing = listStationSegments(stationId).map((segment) => segment.id);
  if (existing.length !== orderedIds.length) {
    throw new Error("Segment order must include each station segment exactly once.");
  }
  const expected = new Set(existing);
  if (!orderedIds.every((id) => expected.has(id))) {
    throw new Error("Segment order contains unknown segments.");
  }
  const apply = db.transaction(() => {
    db.prepare(`UPDATE segments SET position = position + 100000 WHERE station_id = ?`).run(stationId);
    for (const [index, segId] of orderedIds.entries()) {
      db.prepare(`UPDATE segments SET position = ? WHERE id = ? AND station_id = ?`).run(index + 1, segId, stationId);
    }
    db.prepare(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(stationId);
  });
  apply();
  return listStationSegments(stationId);
}

export function findCachedTtsSegment(
  stationId: number,
  body: string,
  voice: string,
  provider: string
): Segment | null {
  const row = db
    .prepare(
      `SELECT * FROM segments
       WHERE station_id = ? AND kind = 'text'
         AND body = ? AND tts_voice = ? AND tts_provider = ?
         AND audio_cid IS NOT NULL AND audio_cid <> ''
       LIMIT 1`
    )
    .get(stationId, body, voice, provider) as SegmentRow | undefined;
  return row ? mapSegment(row) : null;
}

export function findGlobalCachedTts(
  body: string,
  voice: string,
  provider: string
): { audioCid: string; audioUrl: string; durationSeconds: number | null } | null {
  const row = db
    .prepare(
      `SELECT audio_cid, audio_url, duration_seconds FROM segments
       WHERE kind = 'text' AND body = ? AND tts_voice = ? AND tts_provider = ?
         AND audio_cid IS NOT NULL AND audio_cid <> ''
       LIMIT 1`
    )
    .get(body, voice, provider) as { audio_cid: string; audio_url: string; duration_seconds: number | null } | undefined;
  if (!row) return null;
  return {
    audioCid: row.audio_cid,
    audioUrl: row.audio_url ?? "",
    durationSeconds: row.duration_seconds
  };
}

export function addPodcastFeed(stationId: number, feedUrl: string, title?: string): PodcastFeed {
  const trimmed = feedUrl.trim();
  if (!trimmed) throw new Error("Feed URL is required.");
  db.prepare(
    `INSERT INTO podcast_feeds (station_id, feed_url, title)
     VALUES (?, ?, ?)
     ON CONFLICT(station_id, feed_url) DO UPDATE SET title = excluded.title`
  ).run(stationId, trimmed, title ?? "");
  const row = db
    .prepare(`SELECT * FROM podcast_feeds WHERE station_id = ? AND feed_url = ?`)
    .get(stationId, trimmed) as PodcastFeedRow;
  return mapFeed(row);
}

export function getPodcastFeed(id: number): PodcastFeed | null {
  const row = db.prepare(`SELECT * FROM podcast_feeds WHERE id = ?`).get(id) as PodcastFeedRow | undefined;
  return row ? mapFeed(row) : null;
}

export function listPodcastFeeds(stationId: number): PodcastFeed[] {
  const rows = db.prepare(`SELECT * FROM podcast_feeds WHERE station_id = ?`).all(stationId) as PodcastFeedRow[];
  return rows.map(mapFeed);
}

export function touchPodcastFeed(id: number): void {
  db.prepare(`UPDATE podcast_feeds SET last_refreshed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
}

export function upsertPodcastEpisode(input: {
  feedId: number;
  guid: string;
  title?: string;
  audioUrl: string;
  publishedAt?: string | null;
  durationSeconds?: number | null;
}): PodcastEpisode {
  db.prepare(
    `INSERT INTO podcast_episodes (feed_id, guid, title, audio_url, published_at, duration_seconds)
     VALUES (@feedId, @guid, @title, @audioUrl, @publishedAt, @durationSeconds)
     ON CONFLICT(feed_id, guid) DO UPDATE SET
       title = excluded.title,
       audio_url = excluded.audio_url,
       published_at = excluded.published_at,
       duration_seconds = excluded.duration_seconds`
  ).run({
    feedId: input.feedId,
    guid: input.guid,
    title: input.title ?? "",
    audioUrl: input.audioUrl,
    publishedAt: input.publishedAt ?? null,
    durationSeconds: input.durationSeconds ?? null
  });
  const row = db
    .prepare(`SELECT * FROM podcast_episodes WHERE feed_id = ? AND guid = ?`)
    .get(input.feedId, input.guid) as PodcastEpisodeRow;
  return mapEpisode(row);
}

export function listPodcastEpisodes(feedId: number, limit = 50): PodcastEpisode[] {
  const rows = db
    .prepare(
      `SELECT * FROM podcast_episodes WHERE feed_id = ? ORDER BY published_at DESC, id DESC LIMIT ?`
    )
    .all(feedId, Math.min(Math.max(limit, 1), 200)) as PodcastEpisodeRow[];
  return rows.map(mapEpisode);
}

export function getPodcastEpisode(id: number): PodcastEpisode | null {
  const row = db.prepare(`SELECT * FROM podcast_episodes WHERE id = ?`).get(id) as PodcastEpisodeRow | undefined;
  return row ? mapEpisode(row) : null;
}

export function listAllFeeds(): PodcastFeed[] {
  const rows = db.prepare(`SELECT * FROM podcast_feeds`).all() as PodcastFeedRow[];
  return rows.map(mapFeed);
}

export function createVoiceClone(input: {
  creatorId: number;
  provider: string;
  externalVoiceId: string;
  displayName?: string;
  sourceCid?: string;
  status?: VoiceClone["status"];
}): VoiceClone {
  db.prepare(
    `INSERT INTO voice_clones (creator_id, provider, external_voice_id, display_name, source_cid, status)
     VALUES (@creatorId, @provider, @externalVoiceId, @displayName, @sourceCid, @status)
     ON CONFLICT(creator_id, provider, external_voice_id) DO UPDATE SET
       display_name = excluded.display_name,
       source_cid = excluded.source_cid,
       status = excluded.status`
  ).run({
    creatorId: input.creatorId,
    provider: input.provider,
    externalVoiceId: input.externalVoiceId,
    displayName: input.displayName ?? "",
    sourceCid: input.sourceCid ?? "",
    status: input.status ?? "PENDING"
  });
  const row = db
    .prepare(`SELECT * FROM voice_clones WHERE creator_id = ? AND provider = ? AND external_voice_id = ?`)
    .get(input.creatorId, input.provider, input.externalVoiceId) as VoiceCloneRow;
  return mapVoiceClone(row);
}

export function listVoiceClones(creatorId: number): VoiceClone[] {
  const rows = db
    .prepare(`SELECT * FROM voice_clones WHERE creator_id = ? ORDER BY created_at DESC, id DESC`)
    .all(creatorId) as VoiceCloneRow[];
  return rows.map(mapVoiceClone);
}

export function getVoiceClone(id: number): VoiceClone | null {
  const row = db.prepare(`SELECT * FROM voice_clones WHERE id = ?`).get(id) as VoiceCloneRow | undefined;
  return row ? mapVoiceClone(row) : null;
}

export function updateVoiceCloneStatus(id: number, status: VoiceClone["status"]): VoiceClone | null {
  db.prepare(`UPDATE voice_clones SET status = ? WHERE id = ?`).run(status, id);
  return getVoiceClone(id);
}

export function deleteVoiceClone(id: number, creatorId: number): boolean {
  const result = db.prepare(`DELETE FROM voice_clones WHERE id = ? AND creator_id = ?`).run(id, creatorId);
  return result.changes > 0;
}
