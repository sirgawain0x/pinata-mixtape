import { dbReady, getSqliteDatabase, useLibsql } from "./db";
import { sqlAll, sqlGet, sqlRun, txRun, withWriteTransaction } from "./sql-bridge";
import type { Transaction } from "@libsql/client";

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

export async function upsertCreatorByWallet(walletAddress: string): Promise<Creator> {
  await dbReady();
  const normalized = walletAddress.toLowerCase();
  await sqlRun(
    `INSERT INTO creators (wallet_address)
     VALUES (?)
     ON CONFLICT(wallet_address) DO NOTHING`,
    [normalized]
  );
  const row = await sqlGet<CreatorRow>(`SELECT * FROM creators WHERE wallet_address = ? COLLATE NOCASE`, [normalized]);
  if (!row) throw new Error("Could not persist creator.");
  return mapCreator(row);
}

export async function getCreator(id: number): Promise<Creator | null> {
  await dbReady();
  const row = await sqlGet<CreatorRow>(`SELECT * FROM creators WHERE id = ?`, [id]);
  return row ? mapCreator(row) : null;
}

export async function getCreatorByWallet(walletAddress: string): Promise<Creator | null> {
  await dbReady();
  const row = await sqlGet<CreatorRow>(`SELECT * FROM creators WHERE wallet_address = ? COLLATE NOCASE`, [walletAddress]);
  return row ? mapCreator(row) : null;
}

export async function updateCreator(
  id: number,
  patch: { displayName?: string; avatarUrl?: string; bio?: string; ttsProvider?: string; ttsVoiceId?: string }
): Promise<Creator | null> {
  await dbReady();
  const current = await getCreator(id);
  if (!current) return null;
  await sqlRun(
    `UPDATE creators
     SET display_name = @displayName,
         avatar_url = @avatarUrl,
         bio = @bio,
         tts_provider = @ttsProvider,
         tts_voice_id = @ttsVoiceId
     WHERE id = @id`,
    {
      id,
      displayName: patch.displayName ?? current.displayName,
      avatarUrl: patch.avatarUrl ?? current.avatarUrl,
      bio: patch.bio ?? current.bio,
      ttsProvider: patch.ttsProvider ?? current.ttsProvider,
      ttsVoiceId: patch.ttsVoiceId ?? current.ttsVoiceId
    }
  );
  return await getCreator(id);
}

const handleRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export async function createStation(input: {
  creatorId: number;
  handle: string;
  name: string;
  tagline?: string;
  coverUrl?: string;
  seedMixId?: number | null;
}): Promise<Station> {
  await dbReady();
  const handle = input.handle.trim().toLowerCase();
  if (!handleRegex.test(handle)) {
    throw new Error("Handle must be 3–32 chars, lowercase letters/digits/hyphens.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const result = await sqlRun(
    `INSERT INTO stations (creator_id, handle, name, tagline, cover_url, seed_mix_id)
       VALUES (@creatorId, @handle, @name, @tagline, @coverUrl, @seedMixId)`,
    {
      creatorId: input.creatorId,
      handle,
      name,
      tagline: input.tagline?.trim() ?? "",
      coverUrl: input.coverUrl?.trim() ?? "",
      seedMixId: input.seedMixId ?? null
    }
  );
  const insertedId = Number(result.lastInsertRowid);
  if (insertedId > 0) {
    const byId = await getStation(insertedId);
    if (byId) return byId;
  }
  const byHandle = await getStationByHandle(handle);
  if (!byHandle) throw new Error("Station was created but could not be loaded.");
  return byHandle;
}

export async function getStation(id: number): Promise<Station | null> {
  await dbReady();
  const row = await sqlGet<StationRow>(`SELECT * FROM stations WHERE id = ?`, [id]);
  return row ? mapStation(row) : null;
}

export async function getStationByHandle(handle: string): Promise<Station | null> {
  await dbReady();
  const row = await sqlGet<StationRow>(`SELECT * FROM stations WHERE handle = ? COLLATE NOCASE`, [handle]);
  return row ? mapStation(row) : null;
}

export async function listStations(filter: { creatorId?: number; publicOnly?: boolean } = {}): Promise<Station[]> {
  await dbReady();
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
  const rows = await sqlAll<StationRow>(`SELECT * FROM stations ${where} ORDER BY updated_at DESC, id DESC`, params);
  return rows.map(mapStation);
}

export async function updateStation(
  id: number,
  patch: { name?: string; tagline?: string; coverUrl?: string; isPublic?: boolean; seedMixId?: number | null }
): Promise<Station | null> {
  await dbReady();
  const current = await getStation(id);
  if (!current) return null;
  await sqlRun(
    `UPDATE stations
     SET name = @name,
         tagline = @tagline,
         cover_url = @coverUrl,
         is_public = @isPublic,
         seed_mix_id = @seedMixId,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`,
    {
      id,
      name: patch.name?.trim() || current.name,
      tagline: patch.tagline ?? current.tagline,
      coverUrl: patch.coverUrl ?? current.coverUrl,
      isPublic: patch.isPublic === undefined ? (current.isPublic ? 1 : 0) : patch.isPublic ? 1 : 0,
      seedMixId: patch.seedMixId === undefined ? current.seedMixId : patch.seedMixId
    }
  );
  return await getStation(id);
}

export async function deleteStation(id: number): Promise<boolean> {
  await dbReady();
  const result = await sqlRun(`DELETE FROM stations WHERE id = ?`, [id]);
  return result.changes > 0;
}

async function nextSegmentPosition(stationId: number): Promise<number> {
  await dbReady();
  const row = await sqlGet<{ max_position: number }>(
    `SELECT COALESCE(MAX(position), 0) AS max_position FROM segments WHERE station_id = ?`,
    [stationId]
  );
  return (row?.max_position ?? 0) + 1;
}

export async function listStationSegments(stationId: number): Promise<Segment[]> {
  await dbReady();
  const rows = await sqlAll<SegmentRow>(
    `SELECT * FROM segments WHERE station_id = ? ORDER BY position ASC, id ASC`,
    [stationId]
  );
  return rows.map(mapSegment);
}

export async function getSegment(id: number): Promise<Segment | null> {
  await dbReady();
  const row = await sqlGet<SegmentRow>(`SELECT * FROM segments WHERE id = ?`, [id]);
  return row ? mapSegment(row) : null;
}

const INSERT_SEGMENT_SQL = `INSERT INTO segments (
        station_id, position, kind, title, body, song_id, audio_cid, audio_url,
        duration_seconds, podcast_episode_id, tts_voice, tts_provider
      ) VALUES (
        @stationId, @position, @kind, @title, @body, @songId, @audioCid, @audioUrl,
        @durationSeconds, @podcastEpisodeId, @ttsVoice, @ttsProvider
      )`;

export async function addSegment(input: {
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
}): Promise<Segment> {
  await dbReady();
  if (!(await getStation(input.stationId))) throw new Error("Station not found.");
  const position =
    typeof input.position === "number" && Number.isFinite(input.position)
      ? Math.max(1, Math.floor(input.position))
      : await nextSegmentPosition(input.stationId);

  const insertParams = {
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
  };

  await withWriteTransaction({
    sqlite: () => {
      const database = getSqliteDatabase();
      database.transaction(() => {
        if (typeof input.position === "number") {
          database
            .prepare(
              `UPDATE segments SET position = position + 1
         WHERE station_id = @stationId AND position >= @position`
            )
            .run({ stationId: input.stationId, position });
        }
        database.prepare(INSERT_SEGMENT_SQL).run(insertParams);
        database.prepare(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(input.stationId);
      })();
    },
    libsql: async (tx) => {
      if (typeof input.position === "number") {
        await txRun(tx, `UPDATE segments SET position = position + 1 WHERE station_id = @stationId AND position >= @position`, {
          stationId: input.stationId,
          position
        });
      }
      await txRun(tx, INSERT_SEGMENT_SQL, insertParams);
      await txRun(tx, `UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [input.stationId]);
    }
  });

  const row = await sqlGet<SegmentRow>(
    `SELECT * FROM segments WHERE station_id = ? AND position = ? ORDER BY id DESC LIMIT 1`,
    [input.stationId, position]
  );
  if (!row) throw new Error("Could not load new segment.");
  return mapSegment(row);
}

export async function updateSegment(
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
): Promise<Segment | null> {
  await dbReady();
  const current = await getSegment(id);
  if (!current) return null;
  await sqlRun(
    `UPDATE segments
     SET title = @title,
         body = @body,
         audio_cid = @audioCid,
         audio_url = @audioUrl,
         duration_seconds = @durationSeconds,
         tts_voice = @ttsVoice,
         tts_provider = @ttsProvider
     WHERE id = @id`,
    {
      id,
      title: patch.title ?? current.title,
      body: patch.body ?? current.body,
      audioCid: patch.audioCid ?? current.audioCid,
      audioUrl: patch.audioUrl ?? current.audioUrl,
      durationSeconds: patch.durationSeconds === undefined ? current.durationSeconds : patch.durationSeconds,
      ttsVoice: patch.ttsVoice ?? current.ttsVoice,
      ttsProvider: patch.ttsProvider ?? current.ttsProvider
    }
  );
  await sqlRun(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [current.stationId]);
  return await getSegment(id);
}

export async function deleteSegment(id: number): Promise<boolean> {
  await dbReady();
  const current = await getSegment(id);
  if (!current) return false;
  const result = await sqlRun(`DELETE FROM segments WHERE id = ?`, [id]);
  if (result.changes > 0) {
    await sqlRun(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [current.stationId]);
  }
  return result.changes > 0;
}

export async function reorderSegments(stationId: number, orderedIds: number[]): Promise<Segment[]> {
  await dbReady();
  if (orderedIds.length === 0 || new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("Segment order must include each station segment exactly once.");
  }
  const existing = (await listStationSegments(stationId)).map((segment) => segment.id);
  if (existing.length !== orderedIds.length) {
    throw new Error("Segment order must include each station segment exactly once.");
  }
  const expected = new Set(existing);
  if (!orderedIds.every((id) => expected.has(id))) {
    throw new Error("Segment order contains unknown segments.");
  }
  await withWriteTransaction({
    sqlite: () => {
      const database = getSqliteDatabase();
      database.transaction(() => {
        database.prepare(`UPDATE segments SET position = position + 100000 WHERE station_id = ?`).run(stationId);
        for (const [index, segId] of orderedIds.entries()) {
          database.prepare(`UPDATE segments SET position = ? WHERE id = ? AND station_id = ?`).run(index + 1, segId, stationId);
        }
        database.prepare(`UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(stationId);
      })();
    },
    libsql: async (tx) => {
      await txRun(tx, `UPDATE segments SET position = position + 100000 WHERE station_id = ?`, [stationId]);
      for (const [index, segId] of orderedIds.entries()) {
        await txRun(tx, `UPDATE segments SET position = ? WHERE id = ? AND station_id = ?`, [index + 1, segId, stationId]);
      }
      await txRun(tx, `UPDATE stations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [stationId]);
    }
  });
  return await listStationSegments(stationId);
}

export async function findCachedTtsSegment(
  stationId: number,
  body: string,
  voice: string,
  provider: string
): Promise<Segment | null> {
  await dbReady();
  const row = await sqlGet<SegmentRow>(
    `SELECT * FROM segments
       WHERE station_id = ? AND kind = 'text'
         AND body = ? AND tts_voice = ? AND tts_provider = ?
         AND audio_cid IS NOT NULL AND audio_cid <> ''
       LIMIT 1`,
    [stationId, body, voice, provider]
  );
  return row ? mapSegment(row) : null;
}

export async function findGlobalCachedTts(
  body: string,
  voice: string,
  provider: string
): Promise<{ audioCid: string; audioUrl: string; durationSeconds: number | null } | null> {
  await dbReady();
  const row = await sqlGet<{ audio_cid: string; audio_url: string; duration_seconds: number | null }>(
    `SELECT audio_cid, audio_url, duration_seconds FROM segments
       WHERE kind = 'text' AND body = ? AND tts_voice = ? AND tts_provider = ?
         AND audio_cid IS NOT NULL AND audio_cid <> ''
       LIMIT 1`,
    [body, voice, provider]
  );
  if (!row) return null;
  return {
    audioCid: row.audio_cid,
    audioUrl: row.audio_url ?? "",
    durationSeconds: row.duration_seconds
  };
}

export async function addPodcastFeed(stationId: number, feedUrl: string, title?: string): Promise<PodcastFeed> {
  await dbReady();
  const trimmed = feedUrl.trim();
  if (!trimmed) throw new Error("Feed URL is required.");
  await sqlRun(
    `INSERT INTO podcast_feeds (station_id, feed_url, title)
     VALUES (?, ?, ?)
     ON CONFLICT(station_id, feed_url) DO UPDATE SET title = excluded.title`,
    [stationId, trimmed, title ?? ""]
  );
  const row = await sqlGet<PodcastFeedRow>(`SELECT * FROM podcast_feeds WHERE station_id = ? AND feed_url = ?`, [
    stationId,
    trimmed
  ]);
  if (!row) throw new Error("Could not load podcast feed.");
  return mapFeed(row);
}

export async function getPodcastFeed(id: number): Promise<PodcastFeed | null> {
  await dbReady();
  const row = await sqlGet<PodcastFeedRow>(`SELECT * FROM podcast_feeds WHERE id = ?`, [id]);
  return row ? mapFeed(row) : null;
}

export async function listPodcastFeeds(stationId: number): Promise<PodcastFeed[]> {
  await dbReady();
  const rows = await sqlAll<PodcastFeedRow>(`SELECT * FROM podcast_feeds WHERE station_id = ?`, [stationId]);
  return rows.map(mapFeed);
}

export async function touchPodcastFeed(id: number): Promise<void> {
  await dbReady();
  await sqlRun(`UPDATE podcast_feeds SET last_refreshed_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

export async function upsertPodcastEpisode(input: {
  feedId: number;
  guid: string;
  title?: string;
  audioUrl: string;
  publishedAt?: string | null;
  durationSeconds?: number | null;
}): Promise<PodcastEpisode> {
  await dbReady();
  await sqlRun(
    `INSERT INTO podcast_episodes (feed_id, guid, title, audio_url, published_at, duration_seconds)
     VALUES (@feedId, @guid, @title, @audioUrl, @publishedAt, @durationSeconds)
     ON CONFLICT(feed_id, guid) DO UPDATE SET
       title = excluded.title,
       audio_url = excluded.audio_url,
       published_at = excluded.published_at,
       duration_seconds = excluded.duration_seconds`,
    {
      feedId: input.feedId,
      guid: input.guid,
      title: input.title ?? "",
      audioUrl: input.audioUrl,
      publishedAt: input.publishedAt ?? null,
      durationSeconds: input.durationSeconds ?? null
    }
  );
  const row = await sqlGet<PodcastEpisodeRow>(
    `SELECT * FROM podcast_episodes WHERE feed_id = ? AND guid = ?`,
    [input.feedId, input.guid]
  );
  if (!row) throw new Error("Could not load podcast episode.");
  return mapEpisode(row);
}

export async function listPodcastEpisodes(feedId: number, limit = 50): Promise<PodcastEpisode[]> {
  await dbReady();
  const rows = await sqlAll<PodcastEpisodeRow>(
    `SELECT * FROM podcast_episodes WHERE feed_id = ? ORDER BY published_at DESC, id DESC LIMIT ?`,
    [feedId, Math.min(Math.max(limit, 1), 200)]
  );
  return rows.map(mapEpisode);
}

export async function getPodcastEpisode(id: number): Promise<PodcastEpisode | null> {
  await dbReady();
  const row = await sqlGet<PodcastEpisodeRow>(`SELECT * FROM podcast_episodes WHERE id = ?`, [id]);
  return row ? mapEpisode(row) : null;
}

export async function listAllFeeds(): Promise<PodcastFeed[]> {
  await dbReady();
  const rows = await sqlAll<PodcastFeedRow>(`SELECT * FROM podcast_feeds`);
  return rows.map(mapFeed);
}

export async function createVoiceClone(input: {
  creatorId: number;
  provider: string;
  externalVoiceId: string;
  displayName?: string;
  sourceCid?: string;
  status?: VoiceClone["status"];
}): Promise<VoiceClone> {
  await dbReady();
  await sqlRun(
    `INSERT INTO voice_clones (creator_id, provider, external_voice_id, display_name, source_cid, status)
     VALUES (@creatorId, @provider, @externalVoiceId, @displayName, @sourceCid, @status)
     ON CONFLICT(creator_id, provider, external_voice_id) DO UPDATE SET
       display_name = excluded.display_name,
       source_cid = excluded.source_cid,
       status = excluded.status`,
    {
      creatorId: input.creatorId,
      provider: input.provider,
      externalVoiceId: input.externalVoiceId,
      displayName: input.displayName ?? "",
      sourceCid: input.sourceCid ?? "",
      status: input.status ?? "PENDING"
    }
  );
  const row = await sqlGet<VoiceCloneRow>(
    `SELECT * FROM voice_clones WHERE creator_id = ? AND provider = ? AND external_voice_id = ?`,
    [input.creatorId, input.provider, input.externalVoiceId]
  );
  if (!row) throw new Error("Could not load voice clone.");
  return mapVoiceClone(row);
}

export async function listVoiceClones(creatorId: number): Promise<VoiceClone[]> {
  await dbReady();
  const rows = await sqlAll<VoiceCloneRow>(
    `SELECT * FROM voice_clones WHERE creator_id = ? ORDER BY created_at DESC, id DESC`,
    [creatorId]
  );
  return rows.map(mapVoiceClone);
}

export async function getVoiceClone(id: number): Promise<VoiceClone | null> {
  await dbReady();
  const row = await sqlGet<VoiceCloneRow>(`SELECT * FROM voice_clones WHERE id = ?`, [id]);
  return row ? mapVoiceClone(row) : null;
}

export async function updateVoiceCloneStatus(id: number, status: VoiceClone["status"]): Promise<VoiceClone | null> {
  await dbReady();
  await sqlRun(`UPDATE voice_clones SET status = ? WHERE id = ?`, [status, id]);
  return await getVoiceClone(id);
}

export async function deleteVoiceClone(id: number, creatorId: number): Promise<boolean> {
  await dbReady();
  const result = await sqlRun(`DELETE FROM voice_clones WHERE id = ? AND creator_id = ?`, [id, creatorId]);
  return result.changes > 0;
}
