# Operations

Use this file when Creative Mixtape needs to understand how the hosted app stores mixes, songs, and timeline moments.

## Storage

The app stores runtime data in SQLite at:

```text
workspace/data/mixtapes.db
```

Main records:

- `mixes`: structured mixtape memory.
- `songs`: reusable track library records.
- `mix_songs`: ordered join table connecting songs to mixes.
- `mix_moments`: timestamped notes, discoveries, set observations, and user memories.

Prefer app APIs when running inside the deployed web environment.

## Mixes API

Storage note:

- A mix has many songs through `mix_songs`.
- A song can belong to many mixes.
- The API still returns expanded ordered tracks on each mix so the frontend can stay simple.

List or search mixes:

```http
GET /app/api/mixes?q=party
```

The mixes API returns expanded ordered `tracks` on each mix, even though the underlying storage is normalized.

Create a mix:

```http
POST /app/api/mixes
Content-Type: application/json

{
  "title": "Neon Rooftop Warm-Up",
  "description": "Warm-up set for first arrivals.",
  "vibe": "warm-up to lift-off",
  "useCase": "house party first hour",
  "duration": "38 min",
  "djPersona": "Velvet Static",
  "coverTheme": "chrome cassette / pink grid",
  "shareNote": "Public tape page with outbound links only.",
  "tags": ["party", "retro", "warm-up"],
  "tracks": [
    {
      "title": "Music Sounds Better With You",
      "artist": "Stardust",
      "releaseYear": "1998",
      "duration": "6:43",
      "energy": "glow",
      "moodTags": ["euphoric"],
      "sceneTags": ["sunset"],
      "notes": "Opens the room."
    }
  ]
}
```

## Songs API

List or search reusable songs:

```http
GET /app/api/songs?q=massive&limit=12
```

Song records are reusable library items. They are not mix-specific ordering instructions.

Create a song:

```http
POST /app/api/songs
Content-Type: application/json

{
  "title": "Tech Noir",
  "artist": "Gunship",
  "energy": "drive"
}
```

Update a song:

```http
PATCH /app/api/songs/2
Content-Type: application/json

{
  "youtubeUrl": "https://www.youtube.com/watch?v=-nC5TBv3sfU"
}
```

Get a single song:

```http
GET /app/api/songs/2
```

## Add Songs To A Mix

Append an existing song to a mix:

```http
POST /app/api/mixes/1/songs
Content-Type: application/json

{
  "songId": 2
}
```

Insert an existing song at a position:

```http
POST /app/api/mixes/1/songs
Content-Type: application/json

{
  "songId": 2,
  "position": 1
}
```

Create a new song and add it to a mix in one step:

```http
POST /app/api/mixes/1/songs
Content-Type: application/json

{
  "song": {
    "title": "Nightcall",
    "artist": "Kavinsky"
  }
}
```

Recommended chat workflow:

1. Create or find songs.
2. Create the mix or fetch the target mix.
3. Add songs to the mix in the intended order.
4. If the user later provides a YouTube URL, patch that specific song record.
5. Use MusicBrainz enrichment when song identity needs a canonical recording reference.

## MusicBrainz API Proxy

Use this for official recording lookup:

```http
GET /app/api/musicbrainz/recordings?title=Teardrop&artist=Massive%20Attack&limit=5
```

Or use a direct query:

```http
GET /app/api/musicbrainz/recordings?query=recording:"Teardrop" AND artist:"Massive Attack"
```

Guidance:

- Prefer MusicBrainz for canonical song identification and metadata lookup.
- Use it to find likely recording pages, release names, and artist credit strings.
- Do not bulk hammer the endpoint. MusicBrainz rate limits by IP.
- The app sends a non-anonymous `User-Agent` and includes a small per-process delay, but the agent should still use this route deliberately.

## Combined Search API

Use this for the hosted sidebar crate search:

```http
GET /app/api/search?q=teardrop
```

Response shape:

```json
{
  "mixes": [...],
  "songs": [...]
}
```

Current UX behavior:

- The sidebar shows separate `Mixes` and `Songs` result groups.
- Queries can match mix metadata or song metadata.
- Clicking a song can jump to a mix that contains it.

## Timeline API

List recent moments:

```http
GET /app/api/timeline?limit=25
```

Create a moment:

```http
POST /app/api/timeline
Content-Type: application/json

{
  "title": "Captured a rooftop warm-up arc",
  "body": "Starts social, then widens into obvious hooks.",
  "kind": "set",
  "mixId": 1
}
```

Supported moment kinds:

- `memory`: durable user taste or context.
- `set`: observations about sequencing or event flow.
- `discovery`: new artist, track, or scene notes.
- `note`: general context that should stick.

## DJ Hosted Broadcast Manifests

If a mix has generated DJ-hosted artifacts, store them under:

```text
workspace/data/generated-mixtapes/<mixId>-dj-hosted/
```

Current expected artifact:

- `dj-script.json`: the broadcast manifest used by the hosted `/app` player for narrative overlays.

Optional artifacts:

- `<clip-name>.mp3|wav|m4a|ogg|aac`: per-segment narration clips such as `intro`, `transition_1`, or `outro`
- a compiled broadcast audio file such as `mix.mp3` if you still generate one

Read manifest (returns `200` with `{ "result": null }` when no manifest exists):

```http
GET /app/api/mixes/6/dj-hosted
```

On Vercel, manifests are stored in the `mix_dj_hosted` table (Turso) after generation; local disk under `workspace/data/generated-mixtapes/` is a dev fallback.

Fetch a clip when present:

```http
GET /app/api/mixes/6/dj-hosted/clip/intro
```

Fetch a compiled broadcast file when present:

```http
GET /app/api/mixes/6/dj-hosted/file?mode=stream
```

Notes:

- The hosted player can run in text-overlay mode even when no clip audio exists.
- Do not assume an ffmpeg-built final MP3 exists; treat compiled audio as optional.
- The manifest route should reflect real files on disk rather than hardcoded assumptions.

## Modeling Guidance

Keep these distinctions clear:

- `songs` are reusable library records.
- `mixes` are curated sequences for a context.
- `mix_songs` defines order and membership.
- `mix_moments` captures timestamped memory about what happened.

Do not treat every appearance of a song in a mix as a brand new song record unless it is genuinely a different version or edit that should stand alone.

## Public share pages

Each mix can expose `slug`, `is_public`, and `published_at`. Public listeners use:

```text
/app/m/{slug}
```

Legacy query links (`?mix=<id>`) still work on the crate home page.

## Station: import a mixtape

Authenticated station owners can bulk-import a saved mix into programming:

```http
POST /app/api/stations/{stationId}/segments/import-mix
Content-Type: application/json

{
  "mixId": 1,
  "clearExisting": false
}
```

When a station has `seed_mix_id` but zero segments, the listen page materializes that mix once on first load.

## Agent suggestions API

Structured helper for Pinata chat (curate, news, broadcast):

```http
POST /app/api/agent/suggestions
Content-Type: application/json

{ "intent": "curate" }
```

```http
POST /app/api/agent/suggestions
Content-Type: application/json

{ "intent": "news", "mixId": 1 }
```

```http
POST /app/api/agent/suggestions
Content-Type: application/json

{ "intent": "broadcast", "mixId": 1 }
```

Post timeline moments after news research:

```http
POST /app/api/timeline
```

## Write protection

Set `MIXTAPE_WRITE_TOKEN` in production and send `Authorization: Bearer <token>` for agent mutations, or sign in with SIWE so mixes can be tied to `creator_id`.

## Phase One Legal Posture

Keep phase one conservative:

- Store metadata.
- Store user notes and sequencing logic.
- Store legal outbound links.

That keeps the first version useful without taking on streaming rights or sketchy sourcing workflows.

## Production deployment checklist (`air.creativeplatform.xyz`)

Required Vercel environment variables:

| Variable | Purpose |
|----------|---------|
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Mixes, stations, `mix_dj_hosted`, SIWE auth (`siwe_nonces`, `sessions`) |
| `PINATA_JWT` (+ gateway vars) | DJ clip / segment audio persistence |

Verify a station handle (e.g. `g2-radio`):

```sql
SELECT handle, is_public, creator_id FROM stations WHERE handle = 'g2-radio' COLLATE NOCASE;
```

If missing in Turso, recreate from `/app/dashboard` while signed in — local SQLite rows do not sync to production.

Verify DJ-hosted API (no manifest is OK):

```http
GET /app/api/mixes/1/dj-hosted
→ 200 { "result": null }
```
