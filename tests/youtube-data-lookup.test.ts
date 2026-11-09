import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test, mock } from "node:test";
import {
  buildYoutubeDataSearchQuery,
  findYoutubeVideoForRecording,
  parseYoutubeDurationSeconds,
  parseYoutubeSearchResponse,
  pickBestYoutubeSearchItem,
  scoreYoutubeSearchCandidate,
} from "../lib/youtube-data-lookup-core";

test("buildYoutubeDataSearchQuery joins artist and title", () => {
  assert.equal(buildYoutubeDataSearchQuery("Song", "Artist"), "Artist Song");
});

test("parseYoutubeDurationSeconds reads ISO-8601 durations", () => {
  assert.equal(parseYoutubeDurationSeconds("PT4M13S"), 253);
  assert.equal(parseYoutubeDurationSeconds("PT1H2M3S"), 3723);
});

test("pickBestYoutubeSearchItem prefers artist match and rejects karaoke", () => {
  const items = [
    {
      id: { videoId: "karaoke12345" },
      snippet: { title: "Song — Karaoke Version", channelTitle: "Karaoke Hits" },
      contentDetails: { duration: "PT4M10S" },
    },
    {
      id: { videoId: "abcdEFGhijk" },
      snippet: { title: "Artist — Song (Official Video)", channelTitle: "ArtistVEVO" },
      contentDetails: { duration: "PT4M12S" },
    },
  ];
  const best = pickBestYoutubeSearchItem(items, "Artist", "Song", 252_000);
  assert.equal(best?.id?.videoId, "abcdEFGhijk");
});

test("scoreYoutubeSearchCandidate is exported for conservative ranking", () => {
  assert(scoreYoutubeSearchCandidate({ snippet: { title: "Artist Song", channelTitle: "Artist" } }, "Artist", "Song") >= 40);
});

test("findYoutubeVideoForRecording falls back without an API key", async () => {
  const previous = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  try {
    const result = await findYoutubeVideoForRecording({ title: "Song", artist: "Artist" });
    assert.equal(result.kind, "search_fallback");
    assert.match(result.searchUrl, /search_query=/);
  } finally {
    if (previous) process.env.YOUTUBE_API_KEY = previous;
  }
});

test("findYoutubeVideoForRecording parses a mocked search response", async () => {
  const previous = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = "test-key";
  mock.method(globalThis, "fetch", async () =>
    Response.json({
      items: [
        {
          id: { videoId: "dQw4w9WgXcQ" },
          snippet: { title: "Artist — Song", channelTitle: "Artist" },
          contentDetails: { duration: "PT3M33S" },
        },
      ],
    })
  );
  try {
    const result = await findYoutubeVideoForRecording({
      musicbrainzId: "mb-test-1",
      title: "Song",
      artist: "Artist",
      durationMs: 213_000,
    });
    assert.equal(result.kind, "video");
    if (result.kind === "video") {
      assert.match(result.watchUrl, /watch\?v=dQw4w9WgXcQ/);
    }
  } finally {
    mock.restoreAll();
    if (previous) process.env.YOUTUBE_API_KEY = previous;
    else delete process.env.YOUTUBE_API_KEY;
  }
});

test("parseYoutubeSearchResponse normalizes arrays", () => {
  assert.equal(parseYoutubeSearchResponse({ items: [] }).length, 0);
  assert.equal(parseYoutubeSearchResponse(null).length, 0);
});

test("YOUTUBE_API_KEY stays out of client components", () => {
  const root = join(process.cwd(), "app");
  const offenders: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        const text = readFileSync(path, "utf8");
        if (text.includes("youtube-data-lookup-core")) offenders.push(path);
        if (text.includes("YOUTUBE_API_KEY")) offenders.push(path);
      }
    }
  }
  walk(root);
  assert.deepEqual(offenders, []);
});
