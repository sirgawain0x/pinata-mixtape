/**
 * One-time schema + migrations shared by local better-sqlite3 and remote Turso/libSQL.
 */
import type { Client } from "@libsql/client";
import type { SqliteDb } from "./db";

export const MIX_SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS mixes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    vibe TEXT,
    use_case TEXT,
    duration TEXT,
    dj_persona TEXT,
    cover_theme TEXT,
    share_note TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    tracks TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    musicbrainz_id TEXT,
    release_year TEXT,
    duration TEXT,
    bpm TEXT,
    energy TEXT,
    mood_tags TEXT NOT NULL DEFAULT '[]',
    scene_tags TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    musicbrainz_url TEXT,
    youtube_url TEXT,
    listen_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mix_songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mix_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE(mix_id, position),
    FOREIGN KEY(mix_id) REFERENCES mixes(id) ON DELETE CASCADE,
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mix_moments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    kind TEXT NOT NULL DEFAULT 'note',
    mix_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(mix_id) REFERENCES mixes(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_mix_songs_mix_position ON mix_songs(mix_id, position);
  CREATE INDEX IF NOT EXISTS idx_mix_songs_song ON mix_songs(song_id);

  CREATE TABLE IF NOT EXISTS mix_dj_hosted (
    mix_id INTEGER PRIMARY KEY,
    manifest_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(mix_id) REFERENCES mixes(id) ON DELETE CASCADE
  );
`;

export const STATION_SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS creators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    tts_provider TEXT,
    tts_voice_id TEXT,
    metoken_address TEXT,
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
`;

export const VOICE_CLONE_MIGRATION_DDL = `
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
`;

function voiceClonesNeedsProviderUniqueMigrationSql(dbLike: Pick<SqliteDb, "prepare">): boolean {
  const row = dbLike
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'voice_clones'`)
    .get() as { sql?: string } | undefined;
  const sql = row?.sql ?? "";
  return sql.includes("UNIQUE(provider, external_voice_id)") && !sql.includes("UNIQUE(creator_id,");
}

export function bootstrapSqlite(database: SqliteDb): void {
  database.exec(MIX_SCHEMA_DDL);
  database.exec(STATION_SCHEMA_DDL);

  try {
    database.exec(`ALTER TABLE songs ADD COLUMN musicbrainz_id TEXT`);
  } catch {
    // exists
  }
  try {
    database.exec(`ALTER TABLE songs ADD COLUMN youtube_url TEXT`);
  } catch {
    // exists
  }
  try {
    database.exec(`ALTER TABLE mix_moments ADD COLUMN segment_id INTEGER`);
  } catch {
    // exists
  }

  try {
    database.exec(`ALTER TABLE mixes ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // exists
  }
  try {
    database.exec(`ALTER TABLE mixes ADD COLUMN slug TEXT`);
  } catch {
    // exists
  }
  try {
    database.exec(`ALTER TABLE mixes ADD COLUMN published_at TEXT`);
  } catch {
    // exists
  }
  try {
    database.exec(`ALTER TABLE mixes ADD COLUMN creator_id INTEGER`);
  } catch {
    // exists
  }
  try {
    database.exec(`ALTER TABLE creators ADD COLUMN metoken_address TEXT`);
  } catch {
    // exists
  }

  try {
    database.exec(`ALTER TABLE songs ADD COLUMN embed_source_kind TEXT NOT NULL DEFAULT 'youtube'`);
  } catch {
    // exists
  }
  try {
    database.exec(`ALTER TABLE songs ADD COLUMN embed_iframe_url TEXT`);
  } catch {
    // exists
  }

  const songExtraColumns = [
    `ALTER TABLE songs ADD COLUMN audio_cid TEXT`,
    `ALTER TABLE songs ADD COLUMN audio_url TEXT`,
    `ALTER TABLE songs ADD COLUMN duration_seconds INTEGER`,
    `ALTER TABLE songs ADD COLUMN is_curated INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE songs ADD COLUMN creative_tv_url TEXT`,
    `ALTER TABLE songs ADD COLUMN creative_tv_post_id TEXT`,
    `ALTER TABLE songs ADD COLUMN livepeer_playback_id TEXT`
  ];
  for (const sql of songExtraColumns) {
    try {
      database.exec(sql);
    } catch {
      // exists
    }
  }

  database.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_mixes_slug_unique ON mixes(slug COLLATE NOCASE) WHERE slug IS NOT NULL AND TRIM(slug) <> ''`
  );

  const runVoiceCloneMigration = database
    .transaction(() => {
      if (!voiceClonesNeedsProviderUniqueMigrationSql(database)) return;
      database.exec(VOICE_CLONE_MIGRATION_DDL);
    })
    .immediate;

  try {
    runVoiceCloneMigration();
  } catch (error) {
    if (voiceClonesNeedsProviderUniqueMigrationSql(database)) throw error;
  }
}

export async function bootstrapLibsql(client: Client): Promise<void> {
  await client.executeMultiple(MIX_SCHEMA_DDL + STATION_SCHEMA_DDL);

  const tryAlter = async (sql: string) => {
    try {
      await client.execute(sql);
    } catch {
      /* column exists */
    }
  };
  await tryAlter(`ALTER TABLE songs ADD COLUMN musicbrainz_id TEXT`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN youtube_url TEXT`);
  await tryAlter(`ALTER TABLE mix_moments ADD COLUMN segment_id INTEGER`);

  await tryAlter(`ALTER TABLE mixes ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1`);
  await tryAlter(`ALTER TABLE mixes ADD COLUMN slug TEXT`);
  await tryAlter(`ALTER TABLE mixes ADD COLUMN published_at TEXT`);
  await tryAlter(`ALTER TABLE mixes ADD COLUMN creator_id INTEGER`);
  await tryAlter(`ALTER TABLE creators ADD COLUMN metoken_address TEXT`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN embed_source_kind TEXT NOT NULL DEFAULT 'youtube'`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN embed_iframe_url TEXT`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN audio_cid TEXT`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN audio_url TEXT`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN duration_seconds INTEGER`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN is_curated INTEGER NOT NULL DEFAULT 0`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN creative_tv_url TEXT`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN creative_tv_post_id TEXT`);
  await tryAlter(`ALTER TABLE songs ADD COLUMN livepeer_playback_id TEXT`);

  try {
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mixes_slug_unique ON mixes(slug COLLATE NOCASE) WHERE slug IS NOT NULL AND TRIM(slug) <> ''`);
  } catch {
    /* exists */
  }

  async function voiceClonesNeedsProviderUniqueMigrationRemote(): Promise<boolean> {
    const rs = await client.execute(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'voice_clones'`
    );
    if (rs.rows.length === 0) return false;
    const sqlIdx = rs.columns.indexOf("sql");
    const row0 = rs.rows[0];
    const cell = sqlIdx >= 0 && row0 ? row0[sqlIdx] : "";
    const sql = String(cell ?? "");
    return sql.includes("UNIQUE(provider, external_voice_id)") && !sql.includes("UNIQUE(creator_id,");
  }

  if (await voiceClonesNeedsProviderUniqueMigrationRemote()) {
    await client.executeMultiple(VOICE_CLONE_MIGRATION_DDL);
  }
}
