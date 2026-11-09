import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePlaylistDraft, mergePlaylistRecordingIds } from "../lib/playlist-draft-merge";

const track = (id: string, title: string) => ({ title, artist: "Artist", musicbrainzId: id, listenUrl: `https://example/${id}` });

test("follow-up add merges recording ids with the previous draft", () => {
  const previous = { title: "Sunset", genre: "Soul", creators: ["G2"], tracks: [track("mb-1", "One")] };
  const nextIds = ["mb-2"];
  const merged = mergePlaylistRecordingIds(previous, nextIds, "add one more song");
  assert.deepEqual(merged, ["mb-1", "mb-2"]);
  const draft = mergePlaylistDraft(previous, { title: "Sunset", tracks: [track("mb-2", "Two")] }, merged);
  assert.equal(draft.title, "Sunset");
  assert.equal(draft.genre, "Soul");
  assert.deepEqual(draft.creators, ["G2"]);
  assert.equal(draft.tracks?.length, 2);
  assert.equal(draft.tracks?.[0].musicbrainzId, "mb-1");
});

test("explicit removal uses the new recording id list", () => {
  const previous = { title: "Sunset", tracks: [track("mb-1", "One"), track("mb-2", "Two")] };
  assert.deepEqual(mergePlaylistRecordingIds(previous, ["mb-1"], "remove the second song"), ["mb-1"]);
});
