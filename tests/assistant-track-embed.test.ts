import assert from "node:assert/strict";
import { test } from "node:test";
import { inferAssistantTrackEmbed } from "../lib/song-playback";

test("real YouTube video URLs use the youtube embed kind", () => {
  const watch = inferAssistantTrackEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(watch.embedSourceKind, "youtube");
  assert.equal(watch.embedIframeUrl, "");

  const short = inferAssistantTrackEmbed(undefined, "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(short.embedSourceKind, "youtube");
  assert.equal(short.youtubeUrl, "https://youtu.be/dQw4w9WgXcQ");

  const embed = inferAssistantTrackEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(embed.embedSourceKind, "youtube");
});

test("YouTube search and non-YouTube streaming URLs stay link_only", () => {
  const search = inferAssistantTrackEmbed("https://www.youtube.com/results?search_query=test");
  assert.equal(search.embedSourceKind, "link_only");

  const spotify = inferAssistantTrackEmbed("https://open.spotify.com/track/6y0dZd4lh0Zd0dZd4lh0Zd");
  assert.equal(spotify.embedSourceKind, "link_only");
  assert.equal(spotify.embedIframeUrl, "");

  const apple = inferAssistantTrackEmbed("https://music.apple.com/us/album/example/123");
  assert.equal(apple.embedSourceKind, "link_only");

  const soundcloud = inferAssistantTrackEmbed("https://soundcloud.com/artist/track");
  assert.equal(soundcloud.embedSourceKind, "link_only");
});
