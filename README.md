# Pinata Mixtape

Pinata Mixtape is a TypeScript + Next.js Pinata agent template for music taste capture, mixtape building, track timelines, and a hosted retro web explorer with an optional broadcast-style player.

It includes:

- `manifest.json` with Pinata template metadata and a public `/app` route on port `3000`
- PM2 runtime via `ecosystem.config.cjs`
- TypeScript Next.js App Router UI mounted at `/app`
- SQLite persistence in `workspace/data/mixtapes.db` for local dev and PM2 installs
- **Vercel / serverless:** set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (Turso libSQL). The ephemeral `/tmp` SQLite path was removed — without Turso, production cannot persist creators and stations across requests.
- Normalized `mixes`, `songs`, and `mix_songs` storage for reusable track memory
- API routes for mix CRUD, song-library search, combined sidebar search, and timestamped timeline moments
- Workspace identity docs for onboarding, DJ personas, operations, and future task ideas
- A seeded retro demo mix so the hosted page is not empty on first run

## Local Usage

```bash
npm install
npm run build
npm start
```

Open `http://localhost:3000/app`.

For development:

```bash
npm run dev
```

## API Routes

- `GET /app/api/mixes?q=term` (add `?all=1` when signed in to list all tapes for import)
- `POST /app/api/mixes`
- `GET /app/api/mixes/:id`
- `PATCH /app/api/mixes/:id`
- `DELETE /app/api/mixes/:id`
- `POST /app/api/mixes/:id/reorder` — `{ "positions": [2,1,3] }`
- `DELETE /app/api/mixes/:id/songs/:position`
- `GET /app/m/:slug` — public share page with Open Graph metadata
- `GET /app/api/mixes/:id/dj-hosted` (returns `{ result: null }` when no DJ-hosted manifest exists)
- `GET /app/api/mixes/:id/dj-hosted/clip/:name`
- `GET /app/api/mixes/:id/dj-hosted/file?mode=stream|download`
- `GET /app/api/musicbrainz/recordings?title=...&artist=...`
- `GET /app/api/songs?q=term&limit=12`
- `GET /app/api/search?q=term`
- `GET /app/api/timeline?limit=25`
- `POST /app/api/timeline`
- `POST /app/api/agent/suggestions` — curate / news / broadcast hints for the Pinata agent
- `POST /app/api/stations/:id/segments/import-mix` — bulk import a mix into station programming (auth required)

## Template Notes

Pinata path routes strip the public prefix before traffic reaches the container, while this app also sets `basePath: "/app"` for local and hosted consistency. Keep the server bound to `0.0.0.0` and port `3000` unless you update `manifest.json`.

This starter intentionally stays on the legal side of phase one. The hosted app shares mix structure, notes, outbound links, and optional DJ-narration manifest metadata for listening overlays.

The hosted `/app` crate supports in-browser mixtape editing (New tape / Edit), MusicBrainz lookup, YouTube and allowlisted iframe links, and public share pages at `/app/m/{slug}`. Pinata chat remains the best place for taste onboarding, news research (posted as timeline moments), and broadcast coaching — see `workspace/OPERATIONS.md` and `POST /app/api/agent/suggestions`.

Set `MIXTAPE_WRITE_TOKEN` in production and pass `Authorization: Bearer <token>` for agent writes, or sign in with SIWE so mixes can be owned via `creator_id`.

If `workspace/data/generated-mixtapes/<mixId>-dj-hosted/dj-script.json` exists (or a row in `mix_dj_hosted` after POST generation with Pinata), the app exposes it through `/app/api/mixes/:id/dj-hosted` and renders a broadcast-style player with narrative lower-thirds. Absence of a manifest is normal and returns `200` with `{ result: null }`. Clip audio and compiled broadcast files are optional.

**Production (`air.creativeplatform.xyz`):** set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `PINATA_JWT`, and session KV vars (see [`lib/auth-storage.ts`](lib/auth-storage.ts)). DJ-hosted manifests persist in Turso; clip audio should be uploaded to Pinata via POST from a machine with `workspace/scripts/venice_dj_poc.py`.

The left sidebar now behaves like a crate search. Queries can match:

- mix metadata such as title, vibe, use case, or tags
- song metadata such as artist, title, energy, notes, mood tags, and scene tags

The UI shows both matching mixes and matching songs. Clicking a song can jump to a mix that contains it.

The template also includes a MusicBrainz recording-search proxy route for official metadata lookup. Use it when you need to ground a song in canonical MusicBrainz recording data instead of guessing.

## First Agent Prompt

```text
You are Pinata Mixtape. First, inspect workspace/BOOTSTRAP.md, workspace/IDENTITY.md, workspace/SOUL.md, workspace/DJ_PERSONALITIES.md, workspace/OPERATIONS.md, workspace/MIXTAPES.md, and workspace/TASK_IDEAS.md. Then run a short onboarding to learn my taste profile, favorite artists, event use cases, desired energy arc, and default DJ persona. Use chat for onboarding, curation, artist news (timeline moments), and broadcast planning. Use the hosted /app route to browse, edit, and share mixtapes; call the app APIs (or POST /app/api/agent/suggestions) to persist mixes and import them into stations.
```
