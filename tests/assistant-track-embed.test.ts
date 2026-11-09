import assert from "node:assert/strict";
import { test } from "node:test";
import { inferAssistantTrackEmbed } from "../lib/song-playback";

test("assistant embed inference uses iframe players for streaming URLs", () => {
  const spotify = inferAssistantTrackEmbed("https://open.spotify.com/track/6y0dZd4lh0Zd0dZd4lh0Zd");
  assert.equal(spotify.embedSourceKind, "iframe_allowed");
  assert.match(spotify.embedIframeUrl, /open\.spotify\.com\/embed/);
  const youtube = inferAssistantTrackEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(youtube.embedSourceKind, "youtube");
});

test("YouTube search URLs stay link_only", () => {
  const result = inferAssistantTrackEmbed("https://www.youtube.com/results?search_query=test");
  assert.equal(result.embedSourceKind, "link_only");
});
