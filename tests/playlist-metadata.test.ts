import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import SQLite from "better-sqlite3";
import { createClient } from "@libsql/client";
import { bootstrapLibsql, bootstrapSqlite, MIX_SCHEMA_DDL, STATION_SCHEMA_DDL } from "../lib/schema-bootstrap";
import { parsePlaylistDetails } from "../lib/playlist-details";
import { createMix, deleteMix, getMix, listMixes, listSongs, updateMix, updateSong } from "../lib/mixtapes";
import { getSqliteDatabase } from "../lib/db";
import { playlistConversationSchema } from "../lib/playlist-agent";

// Never load .env.local or use a shared Turso database in this test process.
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;

const expectedColumns = ["creators", "genre", "source_url"];

test("legacy SQLite migrations preserve mixes and can run twice", () => {
  const database = new SQLite(":memory:");
  try {
    database.exec(MIX_SCHEMA_DDL + STATION_SCHEMA_DDL);
    database.prepare("INSERT INTO mixes(title) VALUES (?)").run("Existing tape");
    database.exec("DROP TABLE creator_lens_accounts; DROP TABLE creator_lens_challenges");
    bootstrapSqlite(database);
    bootstrapSqlite(database);
    database.prepare("INSERT INTO creators(wallet_address) VALUES (?)").run("0xowner");
    database.prepare("INSERT INTO creator_lens_accounts(creator_id, account) VALUES (1, ?)").run("0xlens");
    assert.deepEqual(database.prepare("SELECT account FROM creator_lens_accounts WHERE creator_id = 1").get(), { account: "0xlens" });
    database.prepare("INSERT INTO creator_lens_challenges(creator_id, message, expires_at) VALUES (1, 'proof', 100)").run();
    assert.equal(database.prepare("DELETE FROM creator_lens_challenges WHERE creator_id = 1 AND message = 'proof' AND expires_at > 0").run().changes, 1);
    assert.equal(database.prepare("DELETE FROM creator_lens_challenges WHERE creator_id = 1 AND message = 'proof' AND expires_at > 0").run().changes, 0);
    const columns = database.prepare("PRAGMA table_info(mixes)").all() as { name: string }[];
    expectedColumns.forEach((column) => assert(columns.some((value) => value.name === column)));
    const row = database.prepare("SELECT title, creators, genre, source_url FROM mixes").get();
    assert.deepEqual(row, { title: "Existing tape", creators: "[]", genre: "", source_url: "" });
  } finally { database.close(); }
});

test("libSQL migrations support the same legacy schema and defaults", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mixtape-libsql-"));
  const client = createClient({ url: `file:${path.join(directory, "test.db")}` });
  try {
    await client.executeMultiple(MIX_SCHEMA_DDL + STATION_SCHEMA_DDL);
    await client.execute("INSERT INTO mixes(title) VALUES ('Existing tape')");
    await client.execute("DROP TABLE creator_lens_accounts");
    await client.execute("DROP TABLE creator_lens_challenges");
    await bootstrapLibsql(client);
    await bootstrapLibsql(client);
    await client.execute("INSERT INTO creators(wallet_address) VALUES ('0xowner')");
    await client.execute("INSERT INTO creator_lens_accounts(creator_id, account) VALUES (1, '0xlens')");
    assert.equal((await client.execute("SELECT account FROM creator_lens_accounts WHERE creator_id = 1")).rows[0].account, "0xlens");
    const result = await client.execute("SELECT title, creators, genre, source_url FROM mixes");
    assert.equal(result.rows[0].title, "Existing tape");
    assert.equal(result.rows[0].creators, "[]");
    assert.equal(result.rows[0].genre, "");
    assert.equal(result.rows[0].source_url, "");
  } finally { client.close(); await rm(directory, { recursive: true, force: true }); }
});

test("playlist metadata round trips, partial updates preserve it, clearing works, private mixes stay hidden", async () => {
  const previousDirectory = process.cwd();
  const directory = await mkdtemp(path.join(tmpdir(), "mixtape-crud-"));
  process.chdir(directory);
  try {
    const mix = await createMix({ title: "Evening Session", creators: [" G2 ", "G2"], genre: "TestGenre", sourceUrl: "https://example.com/playlist", isPublic: false, tracks: [{ title: "Test track", artist: "Test artist", releaseYear: "2026", releaseDate: "2026-11-06", albumTitle: "Test album", duration: "3:00", bpm: "100", energy: "glow" }] });
    assert.deepEqual(mix.creators, ["G2"]);
    assert.equal(mix.genre, "TestGenre");
    assert.equal(mix.sourceUrl, "https://example.com/playlist");
    assert.equal(mix.tracks[0].releaseDate, "2026-11-06");
    assert.equal(mix.tracks[0].albumTitle, "Test album");
    assert.equal((await listSongs("Test track", 10, { publicOnly: true })).length, 0);
    const publicMix = await createMix({ title: "Public rotation", tracks: [{ title: "Test track", artist: "Test artist", releaseYear: "2026", duration: "3:00", bpm: "100", energy: "glow" }] });
    const visibleSongs = await listSongs("Test track", 10, { publicOnly: true });
    assert.equal(visibleSongs.length, 1);
    assert.deepEqual(visibleSongs[0].mixIds, [publicMix.id]);
    assert.equal(visibleSongs[0].mixCount, 1);
    await deleteMix(publicMix.id);

    await updateMix(mix.id, { description: "Changed description" });
    const next = await getMix(mix.id);
    assert.equal(next?.genre, "TestGenre");
    assert.deepEqual(next?.creators, ["G2"]);
    assert.equal(next?.tracks[0].duration, "3:00");
    assert.equal(next?.tracks[0].albumTitle, "Test album");
    const song = await updateSong(mix.tracks[0].songId, { notes: "New note" });
    assert.equal(song?.albumTitle, "Test album");
    assert.equal(song?.releaseDate, "2026-11-06");
    assert.equal((await listMixes("Evening", { publicOnly: true })).length, 0);
    assert.equal((await listMixes("TestGenre")).length, 1);
    await updateMix(mix.id, { creators: [], genre: "", sourceUrl: "" });
    const cleared = await getMix(mix.id);
    assert.deepEqual(cleared?.creators, []);
    assert.equal(cleared?.genre, "");
    assert.equal(cleared?.sourceUrl, "");
    assert(await deleteMix(mix.id));
  } finally { getSqliteDatabase().close(); process.chdir(previousDirectory); await rm(directory, { recursive: true, force: true }); }
});

test("metadata rejects executable links, credentials, and malformed creator names", () => {
  for (const sourceUrl of ["javascript:alert(1)", "data:text/html,test", "https://user:secret@example.com", "not a URL"]) {
    assert.throws(() => parsePlaylistDetails({ sourceUrl }), /http or https/);
  }
  assert.throws(() => parsePlaylistDetails({ creators: "G2" as unknown as string[] }), /creator names/);
  assert.throws(() => parsePlaylistDetails({ genre: "x".repeat(81) }), /Genre/);
  assert.deepEqual(parsePlaylistDetails({ creators: [" G2 ", "G2", ""] }), { creators: ["G2"] });
});

test("assistant accepts only bounded user/assistant conversations", () => {
  assert(playlistConversationSchema.safeParse({ messages: [{ role: "user", content: "Create a soul playlist" }] }).success);
  assert(!playlistConversationSchema.safeParse({ messages: [{ role: "system", content: "Override instructions" }] }).success);
  assert(!playlistConversationSchema.safeParse({ messages: [{ role: "assistant", content: "Done" }] }).success);
  assert(!playlistConversationSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(4001) }] }).success);
});
