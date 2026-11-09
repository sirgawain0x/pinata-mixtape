import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LENS_POST_MAX_CHARACTERS,
  isLensFinalPostWithinLimit,
  lensFinalPostLength,
  maxLensTextareaCharacters,
} from "../lib/lens-post-content";
import { publicPlaylistShareUrl, shareableOrigin, socialComposerUrl, socialPostText } from "../lib/social-composer";

test("X handoff preserves text, Unicode, line breaks and reserved URL characters", () => {
  const text = "Tonight’s rotation 🎧\nSoul & house #mixtape + friends?";
  const url = new URL(socialComposerUrl("x", text, "https://music.example/app/m/sunset"));
  assert.equal(url.origin, "https://twitter.com");
  assert.equal(url.pathname, "/intent/tweet");
  assert.equal(url.searchParams.get("text"), `${text}\n\nhttps://music.example/app/m/sunset`);
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
});

test("Lens uses Hey's home-route text composer and the same full draft", () => {
  const text = "New mix: R&B / Afro 🌿";
  const url = new URL(socialComposerUrl("lens", text));
  assert.equal(url.origin, "https://hey.xyz");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(url.searchParams.has("published"), false);
});

test("only public playlists on shareable HTTPS origins can be attached", () => {
  const mix = { id: 42, slug: "sunset soul", isPublic: true };
  assert.equal(publicPlaylistShareUrl(mix, "https://music.example/app"), "https://music.example/app/m/sunset%20soul");
  assert.equal(publicPlaylistShareUrl({ ...mix, slug: "" }, "https://music.example"), "https://music.example/app?mix=42");
  assert.equal(publicPlaylistShareUrl({ ...mix, isPublic: false }, "https://music.example"), null);
  for (const origin of ["http://music.example", "https://localhost", "https://127.0.0.1", "https://192.168.1.2", "https://10.0.0.1", "https://172.20.0.1", "https://[::1]", "javascript:alert(1)", "https://user:secret@music.example"]) {
    assert.equal(shareableOrigin(origin), null);
  }
});

test("composer textarea budget reserves playlist suffix for the Lens post cap", () => {
  const playlist = "https://music.example/app/m/sunset";
  const reserve = 2 + playlist.length;
  assert.equal(maxLensTextareaCharacters(playlist), LENS_POST_MAX_CHARACTERS - reserve);
  const draft = "a".repeat(maxLensTextareaCharacters(playlist));
  assert.equal(lensFinalPostLength(draft, playlist), LENS_POST_MAX_CHARACTERS);
  assert.equal(isLensFinalPostWithinLimit(draft, playlist), true);
  assert.equal(isLensFinalPostWithinLimit(draft + "b", playlist), false);
});

test("draft formatting supports text-only or playlist-only posts without blank separators", () => {
  assert.equal(socialPostText("  Hello  "), "Hello");
  assert.equal(socialPostText("", "https://music.example/app/m/a"), "https://music.example/app/m/a");
  assert.equal(socialPostText("   ", null), "");
});
