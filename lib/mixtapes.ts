import { db } from "./db";
import { searchMusicBrainzRecordings } from "./musicbrainz";

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
  musicbrainzUrl?: string;
  youtubeUrl?: string;
  listenUrl?: string;
};

export type Track = Required<
  Omit<
    TrackInput,
    "releaseYear" | "duration" | "bpm" | "energy" | "notes" | "musicbrainzUrl" | "youtubeUrl" | "listenUrl" | "moodTags" | "sceneTags"
  >
> & {
  releaseYear: string;
  duration: string;
  bpm: string;
  energy: string;
  moodTags: string[];
  sceneTags: string[];
  notes: string;
  musicbrainzUrl: string;
  youtubeUrl: string;
  listenUrl: string;
};

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
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
};

export type Song = Track & {
  id: number;
  musicbrainzId: string;
  mixCount: number;
  mixIds: number[];
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

db.exec(`
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
`);
try {
  db.exec(`ALTER TABLE songs ADD COLUMN musicbrainz_id TEXT`);
} catch {
  // Column already exists in upgraded databases.
}
try {
  db.exec(`ALTER TABLE songs ADD COLUMN youtube_url TEXT`);
} catch {
  // Column already exists in upgraded databases.
}

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

function normalizeTrack(input: TrackInput): Track {
  const title = input.title?.trim() ?? "";
  const artist = input.artist?.trim() ?? "";
  if (!title || !artist) {
    throw new Error("Each track requires a title and artist.");
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
    musicbrainzUrl: input.musicbrainzUrl?.trim() || buildMusicBrainzSearchUrl(title, artist),
    youtubeUrl: input.youtubeUrl?.trim() || "",
    listenUrl: input.listenUrl?.trim() || buildYoutubeSearchUrl(title, artist)
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
    musicbrainzUrl: row.musicbrainz_url?.trim() || buildMusicBrainzSearchUrl(title, artist),
    youtubeUrl: row.youtube_url ?? "",
    listenUrl: row.listen_url?.trim() || buildYoutubeSearchUrl(title, artist)
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
    musicbrainzId: row.musicbrainz_id ?? "",
    mixCount: row.mix_count,
    mixIds,
    ...mapSong(row)
  };
}

function listTracksForMix(mixId: number): Track[] {
  const rows = db
    .prepare(
      `SELECT songs.*, mix_songs.position
       FROM mix_songs
       JOIN songs ON songs.id = mix_songs.song_id
       WHERE mix_songs.mix_id = ?
       ORDER BY mix_songs.position ASC, mix_songs.id ASC`
    )
    .all(mixId) as MixSongRow[];

  return rows.map(mapSong);
}

function mapMix(row: MixRow): Mix {
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
    tracks: listTracksForMix(row.id),
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

const upsertSongStatement = db.prepare(
  `INSERT INTO songs (
    fingerprint, title, artist, musicbrainz_id, release_year, duration, bpm, energy, mood_tags, scene_tags, notes, musicbrainz_url, youtube_url, listen_url
  ) VALUES (
    @fingerprint, @title, @artist, @musicbrainzId, @releaseYear, @duration, @bpm, @energy, @moodTags, @sceneTags, @notes, @musicbrainzUrl, @youtubeUrl, @listenUrl
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
    updated_at = CURRENT_TIMESTAMP`
);

const selectSongIdByFingerprint = db.prepare("SELECT id FROM songs WHERE fingerprint = ?");

function upsertSong(track: Track): number {
  const fingerprint = fingerprintForTrack(track);

  upsertSongStatement.run({
    fingerprint,
    title: track.title,
    artist: track.artist,
    musicbrainzId: "",
    releaseYear: track.releaseYear,
    duration: track.duration,
    bpm: track.bpm,
    energy: track.energy,
    moodTags: JSON.stringify(track.moodTags),
    sceneTags: JSON.stringify(track.sceneTags),
    notes: track.notes,
    musicbrainzUrl: track.musicbrainzUrl,
    youtubeUrl: track.youtubeUrl,
    listenUrl: track.listenUrl
  });

  const row = selectSongIdByFingerprint.get(fingerprint) as { id: number } | undefined;
  if (!row) throw new Error("Could not persist song.");
  return row.id;
}

function replaceMixSongs(mixId: number, tracks: Track[]): void {
  db.prepare("DELETE FROM mix_songs WHERE mix_id = ?").run(mixId);

  const insertMixSong = db.prepare(
    `INSERT INTO mix_songs (mix_id, song_id, position)
     VALUES (@mixId, @songId, @position)`
  );

  for (const [index, track] of tracks.entries()) {
    const songId = upsertSong(track);
    insertMixSong.run({
      mixId,
      songId,
      position: index + 1
    });
  }
}

function migrateLegacyTracks(): void {
  const legacyRows = db
    .prepare(
      `SELECT mixes.*
       FROM mixes
       WHERE tracks <> '[]'
         AND NOT EXISTS (
           SELECT 1 FROM mix_songs WHERE mix_songs.mix_id = mixes.id
         )`
    )
    .all() as MixRow[];

  if (legacyRows.length === 0) return;

  const migrate = db.transaction((rows: MixRow[]) => {
    for (const row of rows) {
      const tracks = parseLegacyTracks(row.tracks);
      replaceMixSongs(row.id, tracks);
    }
  });

  migrate(legacyRows);
}

migrateLegacyTracks();

export function listMixes(query = ""): Mix[] {
  const search = query.trim();
  if (!search) {
    const rows = db.prepare("SELECT * FROM mixes ORDER BY updated_at DESC, id DESC").all() as MixRow[];
    return rows.map(mapMix);
  }

  const like = `%${search}%`;
  const rows = db
    .prepare(
      `SELECT DISTINCT mixes.*
       FROM mixes
       LEFT JOIN mix_songs ON mix_songs.mix_id = mixes.id
       LEFT JOIN songs ON songs.id = mix_songs.song_id
       WHERE mixes.title LIKE @like
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
       ORDER BY mixes.updated_at DESC, mixes.id DESC`
    )
    .all({ like }) as MixRow[];

  return rows.map(mapMix);
}

export function listSongs(query = "", limit = 12): Song[] {
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
    const rows = db
      .prepare(
        `${baseQuery}
         GROUP BY songs.id
         ORDER BY songs.updated_at DESC, songs.id DESC
         LIMIT ?`
      )
      .all(Math.min(Math.max(limit, 1), 50)) as SongListRow[];
    return rows.map(mapLibrarySong);
  }

  const like = `%${search}%`;
  const rows = db
    .prepare(
      `${baseQuery}
       WHERE songs.title LIKE @like
          OR songs.artist LIKE @like
          OR songs.energy LIKE @like
          OR songs.notes LIKE @like
          OR songs.mood_tags LIKE @like
          OR songs.scene_tags LIKE @like
       GROUP BY songs.id
       ORDER BY songs.updated_at DESC, songs.id DESC
       LIMIT @limit`
    )
    .all({ like, limit: Math.min(Math.max(limit, 1), 50) }) as SongListRow[];

  return rows.map(mapLibrarySong);
}

export function getSong(id: number): Song | null {
  const row = db
    .prepare(
      `SELECT
        songs.*,
        COUNT(DISTINCT mix_songs.mix_id) AS mix_count,
        COALESCE(json_group_array(DISTINCT mix_songs.mix_id), '[]') AS mix_ids
       FROM songs
       LEFT JOIN mix_songs ON mix_songs.song_id = songs.id
       WHERE songs.id = ?
       GROUP BY songs.id`
    )
    .get(id) as SongListRow | undefined;

  return row ? mapLibrarySong(row) : null;
}

export function createSong(input: SongInput): Song {
  const track = normalizeTrack(input);
  const songId = upsertSong(track);
  return getSong(songId) as Song;
}

export function updateSong(id: number, input: Partial<SongInput>): Song | null {
  const current = getSong(id);
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
    musicbrainzUrl: input.musicbrainzUrl?.trim() ?? current.musicbrainzUrl,
    youtubeUrl: input.youtubeUrl?.trim() ?? current.youtubeUrl,
    listenUrl: input.listenUrl?.trim() ?? current.listenUrl
  });

  db.prepare(
    `UPDATE songs
     SET title = @title,
         artist = @artist,
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
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run({
    id,
    title: next.title,
    artist: next.artist,
    releaseYear: next.releaseYear,
    duration: next.duration,
    bpm: next.bpm,
    energy: next.energy,
    moodTags: JSON.stringify(next.moodTags),
    sceneTags: JSON.stringify(next.sceneTags),
    notes: next.notes,
    musicbrainzUrl: next.musicbrainzUrl,
    youtubeUrl: next.youtubeUrl,
    listenUrl: next.listenUrl
  });

  return getSong(id);
}

export function addSongToMix(
  mixId: number,
  input: { songId?: number; position?: number; song?: SongInput }
): Mix | null {
  const mix = getMix(mixId);
  if (!mix) return null;

  const resolvedSongId =
    typeof input.songId === "number" && Number.isFinite(input.songId)
      ? input.songId
      : input.song
        ? createSong(input.song).id
        : null;

  if (!resolvedSongId) {
    throw new Error("Provide either `songId` or `song` when adding to a mix.");
  }

  const targetSong = getSong(resolvedSongId);
  if (!targetSong) {
    throw new Error("Song not found.");
  }

  const currentCountRow = db
    .prepare("SELECT COUNT(*) AS count, COALESCE(MAX(position), 0) AS max_position FROM mix_songs WHERE mix_id = ?")
    .get(mixId) as { count: number; max_position: number };

  const requestedPosition =
    typeof input.position === "number" && Number.isFinite(input.position)
      ? Math.max(1, Math.floor(input.position))
      : currentCountRow.max_position + 1;

  const insert = db.transaction(() => {
    db.prepare(
      `UPDATE mix_songs
       SET position = position + 1
       WHERE mix_id = @mixId AND position >= @position`
    ).run({
      mixId,
      position: requestedPosition
    });

    db.prepare(
      `INSERT INTO mix_songs (mix_id, song_id, position)
       VALUES (@mixId, @songId, @position)`
    ).run({
      mixId,
      songId: targetSong.id,
      position: requestedPosition
    });

    db.prepare("UPDATE mixes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(mixId);
  });

  insert();
  return getMix(mixId);
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
  const current = getSong(id);
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

  db.prepare(
    `UPDATE songs
     SET musicbrainz_id = @musicbrainzId,
         musicbrainz_url = @musicbrainzUrl,
         youtube_url = @youtubeUrl,
         release_year = CASE
           WHEN @releaseYear <> '' THEN @releaseYear
           ELSE release_year
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run({
    id,
    musicbrainzId: next.musicbrainzId,
    musicbrainzUrl: next.musicbrainzUrl,
    youtubeUrl: next.youtubeUrl,
    releaseYear: next.releaseYear
  });

  return getSong(id);
}

export function getMix(id: number): Mix | null {
  const row = db.prepare("SELECT * FROM mixes WHERE id = ?").get(id) as MixRow | undefined;
  return row ? mapMix(row) : null;
}

export function createMix(input: MixInput): Mix {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const tracks = (input.tracks ?? []).map(normalizeTrack);
  const result = db
    .prepare(
      `INSERT INTO mixes (
        title, description, vibe, use_case, duration, dj_persona, cover_theme, share_note, tags, tracks
      ) VALUES (
        @title, @description, @vibe, @useCase, @duration, @djPersona, @coverTheme, @shareNote, @tags, '[]'
      )`
    )
    .run({
      title,
      description: input.description?.trim() || "",
      vibe: input.vibe?.trim() || "",
      useCase: input.useCase?.trim() || "",
      duration: input.duration?.trim() || "",
      djPersona: input.djPersona?.trim() || "",
      coverTheme: input.coverTheme?.trim() || "",
      shareNote: input.shareNote?.trim() || "",
      tags: JSON.stringify(normalizeList(input.tags))
    });

  const mixId = Number(result.lastInsertRowid);
  replaceMixSongs(mixId, tracks);
  return getMix(mixId) as Mix;
}

export function updateMix(id: number, input: Partial<MixInput>): Mix | null {
  const current = getMix(id);
  if (!current) return null;

  const nextTracks = input.tracks ? input.tracks.map(normalizeTrack) : current.tracks;
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
    id
  };

  db.prepare(
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
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run(next);

  replaceMixSongs(id, nextTracks);
  return getMix(id);
}

export function deleteMix(id: number): boolean {
  db.prepare("DELETE FROM mix_songs WHERE mix_id = ?").run(id);
  const result = db.prepare("DELETE FROM mixes WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listMixMoments(limit = 25): MixMoment[] {
  const rows = db
    .prepare(
      `SELECT mix_moments.*, mixes.title AS mix_title
       FROM mix_moments
       LEFT JOIN mixes ON mixes.id = mix_moments.mix_id
       ORDER BY mix_moments.created_at DESC, mix_moments.id DESC
       LIMIT ?`
    )
    .all(Math.min(Math.max(limit, 1), 100)) as MixMomentRow[];

  return rows.map(mapMixMoment);
}

export function createMixMoment(input: MixMomentInput): MixMoment {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  const result = db
    .prepare(
      `INSERT INTO mix_moments (title, body, kind, mix_id)
       VALUES (@title, @body, @kind, @mixId)`
    )
    .run({
      title,
      body: input.body?.trim() || "",
      kind: normalizeMomentKind(input.kind),
      mixId: input.mixId ?? null
    });

  return listMixMoments(100).find((moment) => moment.id === Number(result.lastInsertRowid)) as MixMoment;
}

export function seedMixes(): Mix[] {
  if (listMixes().length > 0) {
    seedMixMoments();
    return listMixes();
  }

  const mix = createMix({
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

  seedMixMoments(mix.id);
  return listMixes();
}

export function seedMixMoments(mixId?: number): MixMoment[] {
  if (listMixMoments(1).length > 0) return listMixMoments();

  createMixMoment({
    title: "Captured a rooftop warm-up arc",
    body: "The target arc starts social and patient, then widens into recognizable hooks once the room is full.",
    kind: "set",
    mixId: mixId ?? listMixes()[0]?.id ?? null
  });

  createMixMoment({
    title: "User asked for a retro AI DJ persona",
    body: "Default to a lightly theatrical host voice, but keep recommendations grounded in actual event pacing.",
    kind: "memory"
  });

  createMixMoment({
    title: "Phase one sourcing rule",
    body: "Store metadata and legal outbound links only. Avoid direct download or audio hosting workflows in the first release.",
    kind: "note"
  });

  return listMixMoments();
}
