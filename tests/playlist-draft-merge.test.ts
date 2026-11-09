import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAssistantEmbedsToTracks, applyPlaylistTrackChange, mergePlaylistDraft } from "../lib/playlist-draft-merge";
import { previousDraftSchema } from "../lib/playlist-previous-draft";

const track = (id: string, title: string) => ({
  title,
  artist: "Artist",
  musicbrainzId: id,
  listenUrl: `https://www.youtube.com/watch?v=${id}`,
});

test("first draft uses recordingIds as the track list", () => {
  const merged = applyPlaylistTrackChange(null, "replace", ["mb-1", "mb-2"], []);
  assert.deepEqual(merged, ["mb-1", "mb-2"]);
});

test("add-one merges onto a 5-track draft without dropping earlier tracks", () => {
  const previous = {
    title: "Sunset",
    tracks: ["mb-1", "mb-2", "mb-3", "mb-4", "mb-5"].map((id) => track(id, id)),
  };
  const merged = applyPlaylistTrackChange(previous, "add", ["mb-6"], []);
  assert.deepEqual(merged, ["mb-1", "mb-2", "mb-3", "mb-4", "mb-5", "mb-6"]);
  const draft = mergePlaylistDraft(
    previous,
    { title: "Sunset", tracks: [track("mb-6", "Six")] },
    merged
  );
  assert.equal(draft.tracks?.length, 6);
  assert.equal(draft.tracks?.[5].musicbrainzId, "mb-6");
});

test("remove-one drops only the requested recording", () => {
  const previous = {
    title: "Sunset",
    tracks: [track("mb-1", "One"), track("mb-2", "Two"), track("mb-3", "Three")],
  };
  const merged = applyPlaylistTrackChange(previous, "remove", [], ["mb-2"]);
  assert.deepEqual(merged, ["mb-1", "mb-3"]);
});

test("replace uses only the new recording list", () => {
  const previous = {
    title: "Sunset",
    tracks: [track("mb-1", "One"), track("mb-2", "Two")],
  };
  const merged = applyPlaylistTrackChange(previous, "replace", ["mb-9", "mb-8"], []);
  assert.deepEqual(merged, ["mb-9", "mb-8"]);
});

test("mergePlaylistDraft recomputes embed fields and ignores client iframe values", () => {
  const previous = {
    title: "Sunset",
    tracks: [
      {
        ...track("mb-1", "One"),
        embedSourceKind: "iframe_allowed" as const,
        embedIframeUrl: "https://open.spotify.com/embed/evil",
      },
    ],
  };
  const draft = mergePlaylistDraft(previous, { title: "Sunset", tracks: [] }, ["mb-1"]);
  assert.equal(draft.tracks?.[0].embedSourceKind, "youtube");
  assert.equal(draft.tracks?.[0].embedIframeUrl, "");
});

test("applyAssistantEmbedsToTracks keeps YouTube search links as link_only", () => {
  const [out] = applyAssistantEmbedsToTracks([
    { title: "T", artist: "A", listenUrl: "https://www.youtube.com/results?search_query=test" },
  ]);
  assert.equal(out.embedSourceKind, "link_only");
});

test("previousDraft schema rejects unknown fields and oversized track lists", () => {
  assert(previousDraftSchema.safeParse({ title: "Ok", tracks: [] }).success);
  assert(!previousDraftSchema.safeParse({ title: "Ok", extra: true }).success);
  assert(
    !previousDraftSchema.safeParse({
      title: "Ok",
      tracks: Array.from({ length: 101 }, (_, index) => ({
        title: `T${index}`,
        artist: "A",
      })),
    }).success
  );
});
