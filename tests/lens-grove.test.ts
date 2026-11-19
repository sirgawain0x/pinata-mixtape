import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { LENS_GROVE_CHAIN_ID, isGroveConfigured, resolveGroveUrl } from "../lib/grove";
import { gatewayUrl, isPinataConfigured } from "../lib/pinata";
import { resolvePlaybackSource } from "../lib/song-playback";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

test("Lens Grove targets Base Mainnet (8453) and defaults to enabled", () => {
  delete process.env.LENS_GROVE_DISABLED;
  assert.equal(LENS_GROVE_CHAIN_ID, 8453);
  assert.equal(isGroveConfigured(), true);
  assert.equal(isPinataConfigured(), true);

  process.env.LENS_GROVE_DISABLED = "true";
  assert.equal(isGroveConfigured(), false);
  assert.equal(isPinataConfigured(), false);
});

test("resolveGroveUrl handles lens://, ipfs://, and https:// URIs cleanly", () => {
  const lensResolved = resolveGroveUrl("lens://abc123storagekey");
  assert.ok(lensResolved.startsWith("https://") && lensResolved.includes("abc123storagekey"));
  assert.equal(gatewayUrl("lens://abc123storagekey"), lensResolved);

  assert.equal(
    resolveGroveUrl("https://api.grove.storage/direct-key"),
    "https://api.grove.storage/direct-key",
  );
  assert.equal(resolveGroveUrl("ipfs://QmTestHash"), "https://ipfs.io/ipfs/QmTestHash");
});

test("resolvePlaybackSource resolves curated lens:// URIs to Grove without Pinata", () => {
  const source = resolvePlaybackSource({
    isCurated: true,
    audioCid: "lens://track01key",
    title: "Track One",
    artist: "Artist",
  });
  assert.equal(source.kind, "pinata");
  assert.equal(source.audioUrl, "https://api.grove.storage/track01key");
  assert.ok(source.audioUrl?.startsWith("https://api.grove.storage/"));
});

test("lib/grove.ts and lib/pinata.ts contain zero Pinata upload calls or PINATA_JWT references", () => {
  const groveSrc = fs.readFileSync(path.join(process.cwd(), "lib", "grove.ts"), "utf8");
  const pinataSrc = fs.readFileSync(path.join(process.cwd(), "lib", "pinata.ts"), "utf8");
  for (const src of [groveSrc, pinataSrc]) {
    assert.equal(src.includes("PINATA_JWT"), false);
    assert.equal(src.includes("uploads.pinata.cloud"), false);
  }
});
