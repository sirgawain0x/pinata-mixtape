import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterPublicPlaybackTracks,
  isTrackHiddenFromPublicPlayback,
  legacyStreamingEditorNote,
  trackHasInAppPlayableSource,
} from "../lib/track-playback-policy";

test("spotify-only tracks are hidden from public playback", () => {
  const track = {
    title: "Song",
    artist: "Artist",
    listenUrl: "https://open.spotify.com/track/6y0dZd4lh0Zd0dZd4lh0Zd",
    embedSourceKind: "iframe_allowed" as const,
    embedIframeUrl: "https://open.spotify.com/embed/track/6y0dZd4lh0Zd0dZd4lh0Zd",
  };
  assert.equal(isTrackHiddenFromPublicPlayback(track), true);
  assert.equal(legacyStreamingEditorNote(track), "Hidden: unsupported source");
});

test("tracks with a YouTube video stay visible", () => {
  const track = {
    title: "Song",
    artist: "Artist",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    embedSourceKind: "youtube" as const,
    listenUrl: "https://open.spotify.com/track/old",
  };
  assert.equal(trackHasInAppPlayableSource(track), true);
  assert.equal(isTrackHiddenFromPublicPlayback(track), false);
});

test("filterPublicPlaybackTracks removes legacy-only rows", () => {
  const tracks = [
    { title: "A", artist: "A", listenUrl: "https://soundcloud.com/a/b" },
    { title: "B", artist: "B", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  ];
  assert.equal(filterPublicPlaybackTracks(tracks).length, 1);
});

test("keeps a non-legacy iframe when a track also has a legacy listening link", () => {
  assert.equal(isTrackHiddenFromPublicPlayback({
    listenUrl: "https://open.spotify.com/track/abc",
    embedSourceKind: "iframe_allowed",
    embedIframeUrl: "https://bandcamp.com/EmbeddedPlayer/track=123/",
  }), false);
});
