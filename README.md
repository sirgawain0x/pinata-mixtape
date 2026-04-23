# Pinata Mixtape

Pinata Mixtape is a TypeScript + Next.js Pinata agent template for music taste capture, mixtape building, track timelines, and a hosted retro web explorer.

It includes:

- `manifest.json` with Pinata template metadata and a public `/app` route on port `3000`
- PM2 runtime via `ecosystem.config.cjs`
- TypeScript Next.js App Router UI mounted at `/app`
- SQLite persistence in `workspace/data/mixtapes.db`
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

- `GET /app/api/mixes?q=term`
- `POST /app/api/mixes`
- `GET /app/api/mixes/:id`
- `PATCH /app/api/mixes/:id`
- `DELETE /app/api/mixes/:id`
- `GET /app/api/musicbrainz/recordings?title=...&artist=...`
- `GET /app/api/songs?q=term&limit=12`
- `GET /app/api/search?q=term`
- `GET /app/api/timeline?limit=25`
- `POST /app/api/timeline`

## Template Notes

Pinata path routes strip the public prefix before traffic reaches the container, while this app also sets `basePath: "/app"` for local and hosted consistency. Keep the server bound to `0.0.0.0` and port `3000` unless you update `manifest.json`.

This starter intentionally stays on the legal side of phase one. The hosted app shares mix structure, notes, and outbound links for listening or metadata lookup. It does not download or proxy audio.

The hosted web route is intentionally read-only. Bootstrap, taste capture, DJ persona selection, mix generation, and timeline logging should happen in the Pinata chat UI at the agent root. The agent can still call the app APIs to save mixes and append timeline moments.

The left sidebar now behaves like a crate search. Queries can match:

- mix metadata such as title, vibe, use case, or tags
- song metadata such as artist, title, energy, notes, mood tags, and scene tags

The UI shows both matching mixes and matching songs. Clicking a song can jump to a mix that contains it.

The template also includes a MusicBrainz recording-search proxy route for official metadata lookup. Use it when you need to ground a song in canonical MusicBrainz recording data instead of guessing.

## First Agent Prompt

```text
You are Pinata Mixtape. First, inspect workspace/BOOTSTRAP.md, workspace/IDENTITY.md, workspace/SOUL.md, workspace/DJ_PERSONALITIES.md, workspace/OPERATIONS.md, workspace/MIXTAPES.md, and workspace/TASK_IDEAS.md. Then run a short onboarding to learn my taste profile, favorite artists, event use cases, desired energy arc, and default DJ persona. Use chat for onboarding and curation. Use the hosted /app route as a read-only retro mixtape explorer.
```
