# Mixtape Album CRUD API Specification

## Base URL
```
/api/v1/mixtape
```

## Authentication
- All endpoints require `Authorization: Bearer <JWT>` (Privy/NextAuth)
- Scopes: `mixtape:read`, `mixtape:write`, `mixtape:publish`, `mixtape:broadcast`

---

## Album Object

```typescript
interface Album {
  id: string;                    // UUID v4
  slug: string;                  // URL-safe, unique, 3-64 chars
  title: string;                 // 1-120 chars
  description: string;           // 0-5000 chars (markdown supported)
  coverArt: ImageAsset;
  djPersona: DJPersonaRef;
  curator: UserRef;
  tracks: Track[];
  setNotes: SetNotes;
  tags: string[];                // Max 20, each 1-30 chars
  visibility: 'public' | 'unlisted' | 'private';
  releaseDate: string;           // ISO 8601
  licenses: LicenseInfo[];
  collaborators: Collaborator[];
  stats: AlbumStats;
  broadcastConfig?: BroadcastConfig;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  publishedAt?: string;          // ISO 8601, set on first publish
}
```

### Nested Types

```typescript
interface ImageAsset {
  url: string;
  alt: string;
  width: number;
  height: number;
  blurhash?: string;
}

interface DJPersonaRef {
  id: string;
  name: string;
  avatar: string;
}

interface UserRef {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
}

interface Track {
  position: number;              // 1-based, required
  title: string;                 // 1-200 chars
  artists: TrackArtist[];
  duration: number;              // seconds, required
  outboundLinks: OutboundLink[]; // At least one required
  musicbrainzId?: string;        // MBID (recording)
  isrc?: string;                 // ISRC
  bpm?: number;
  key?: string;                  // Camelot notation (e.g., "8A")
  credits?: TrackCredits;
  startTime?: number;            // For continuous mixes
  endTime?: number;
}

interface TrackArtist {
  name: string;
  musicbrainzId?: string;
  role?: 'primary' | 'featured' | 'remixer' | 'producer';
}

interface OutboundLink {
  platform: 'spotify' | 'apple_music' | 'youtube' | 'soundcloud' | 'bandcamp' | 'youtube_music' | 'tidal' | 'deezer' | 'other';
  url: string;
  isPrimary: boolean;
}

interface TrackCredits {
  writers?: string[];
  producers?: string[];
  label?: string;
  publisher?: string;
  year?: number;
}

interface SetNotes {
  description: string;           // The "handwritten note"
  energyArc: string;             // Pacing narrative
  useCase: string;               // Context (rooftop, gym, etc.)
  runtimeTarget: number;         // Target seconds
  defaultDJ: string;             // DJ persona ID
}

interface LicenseInfo {
  type: 'cc_by' | 'cc_by_sa' | 'cc_by_nd' | 'cc_by_nc' | 'cc_by_nc_sa' | 'cc_by_nc_nd' | 'all_rights_reserved' | 'custom';
  url: string;
  customText?: string;
}

interface Collaborator {
  userId: string;
  role: 'co_curator' | 'featured_artist' | 'producer' | 'designer' | 'writer';
  revenueShare?: number;         // 0-100, sum ≤ 100
}

interface AlbumStats {
  plays: number;
  saves: number;
  shares: number;
  avgListenDuration: number;     // seconds
  completionRate: number;        // 0-1
}

interface BroadcastConfig {
  isStation: boolean;
  schedule: BroadcastScheduleEntry[];
  exclusiveContent: ExclusiveContent[];
  adConfig?: AdConfig;
  tokenConfig?: TokenConfig;
}

interface BroadcastScheduleEntry {
  dayOfWeek: 0-6;                // 0 = Sunday
  startTime: string;             // HH:MM (24hr)
  endTime: string;               // HH:MM
  mixtapeId: string;             // Album ID to play
  isLive: boolean;
}

interface ExclusiveContent {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  unlockTier: string;            // Tier ID from tokenConfig
  releasedAt: string;
}

interface AdConfig {
  enabled: boolean;
  voiceCloneEnabled: boolean;
  voiceCloneId?: string;
  minIntervalMinutes: number;    // ≥ 5
  maxPerHour: number;            // ≤ 12
}

interface TokenConfig {
  name: string;
  symbol: string;                // 3-5 chars
  totalSupply: string;           // BigInt string
  decimals: number;              // 18
  distribution: TokenDistribution[];
}

interface TokenDistribution {
  allocation: 'creator' | 'community' | 'treasury' | 'liquidity' | 'rewards';
  percentage: number;            // 0-100, sum = 100
  vestingMonths?: number;
  cliffMonths?: number;
}
```

---

## Endpoints

### 1. Create Album
**POST** `/albums`

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string",
  "coverArt": { "url": "string", "alt": "string", "width": 1200, "height": 1200 },
  "djPersonaId": "string (required)",
  "tracks": [
    {
      "position": 1,
      "title": "string",
      "artists": [{ "name": "string" }],
      "duration": 240,
      "outboundLinks": [{ "platform": "spotify", "url": "https://...", "isPrimary": true }],
      "musicbrainzId": "string",
      "isrc": "string",
      "bpm": 128,
      "key": "8A"
    }
  ],
  "setNotes": {
    "description": "string",
    "energyArc": "string",
    "useCase": "string",
    "runtimeTarget": 3600,
    "defaultDJ": "string"
  },
  "tags": ["string"],
  "visibility": "private",
  "releaseDate": "2026-01-15T00:00:00Z",
  "licenses": [{ "type": "all_rights_reserved", "url": "https://..." }],
  "collaborators": []
}
```

**Response: 201 Created**
```json
{
  "album": { /* Album object */ },
  "validation": {
    "passed": true,
    "blockers": [],
    "warnings": []
  }
}
```

**Validation:**
- Runs TypeSafe validation schema (see 01-typesafe-schema.md)
- Returns `validation.blockers` if completeness checks fail
- Returns `validation.warnings` if quality scores < 3

**Errors:**
- `400` - Validation failed (blockers present)
- `401` - Unauthorized
- `403` - Insufficient scope (`mixtape:write`)
- `409` - Slug conflict
- `422` - Invalid track positions (duplicates, gaps)

---

### 2. Get Album
**GET** `/albums/:idOrSlug`

**Query Params:**
- `include=tracks,stats,broadcast` - Optional includes

**Response: 200 OK**
```json
{
  "album": { /* Full Album object */ },
  "canEdit": true,
  "canPublish": true,
  "canBroadcast": false
}
```

**Response: 404 Not Found**
```json
{ "error": "Album not found" }
```

**Visibility Rules:**
- `public` - Anyone can view
- `unlisted` - Anyone with link can view (no search/index)
- `private` - Only curator, collaborators, admins

---

### 3. Update Album
**PATCH** `/albums/:id`

**Request Body:** (All fields optional)
```json
{
  "title": "string",
  "description": "string",
  "coverArt": { "url": "string", "alt": "string" },
  "djPersonaId": "string",
  "tracks": [ /* Full track array - replaces existing */ ],
  "setNotes": { /* SetNotes object */ },
  "tags": ["string"],
  "visibility": "public",
  "releaseDate": "2026-01-15T00:00:00Z",
  "licenses": [ /* LicenseInfo[] */ ],
  "collaborators": [ /* Collaborator[] */ ],
  "broadcastConfig": { /* BroadcastConfig */ }
}
```

**Response: 200 OK**
```json
{
  "album": { /* Updated Album */ },
  "validation": { /* Validation result */ }
}
```

**Validation on Update:**
- If `visibility` changes to `public` → runs Publish gate validation
- If `broadcastConfig.isStation` = true → runs Broadcast gate validation
- Track reordering allowed (position renumbered)

**Errors:**
- `400` - Validation blockers (cannot publish with blockers)
- `403` - Not curator/collaborator/admin
- `404` - Not found
- `409` - Slug conflict (if title changed)

---

### 4. Delete Album
**DELETE** `/albums/:id`

**Response: 204 No Content**

**Errors:**
- `403` - Not curator/admin
- `404` - Not found
- `409` - Has active broadcast schedule (must disable first)

---

### 5. List Albums (Curator)
**GET** `/albums`

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `curatorId` | string | current user | Filter by curator |
| `visibility` | enum | all | `public`, `unlisted`, `private`, `all` |
| `status` | enum | all | `draft`, `published`, `broadcast` |
| `search` | string | - | Search title, description, tags |
| `sort` | enum | `updatedAt` | `createdAt`, `updatedAt`, `publishedAt`, `plays`, `saves` |
| `order` | enum | `desc` | `asc`, `desc` |
| `limit` | int | 20 | 1-100 |
| `cursor` | string | - | Pagination cursor |

**Response: 200 OK**
```json
{
  "albums": [ /* Album[] (without full tracks) */ ],
  "pagination": {
    "nextCursor": "string",
    "hasMore": true,
    "total": 42
  }
}
```

---

### 6. Publish Album
**POST** `/albums/:id/publish`

**Request Body:**
```json
{
  "visibility": "public",        // Required: "public" or "unlisted"
  "releaseDate": "2026-01-15T00:00:00Z"  // Optional, defaults to now
}
```

**Response: 200 OK**
```json
{
  "album": { /* Album with publishedAt set */ },
  "shareUrl": "https://mixtape.creativeplatform.xyz/app/m/slug"
}
```

**Preconditions (validated):**
- All TypeSafe completeness Noul = `true`
- All TypeSafe quality Score ≥ 3
- At least 1 track with outbound link
- Cover art present

**Errors:**
- `400` - Validation failed (returns blockers/warnings)
- `403` - Not curator/admin
- `409` - Already published (use PATCH to update)

---

### 7. Unpublish Album
**POST** `/albums/:id/unpublish`

**Response: 200 OK**
```json
{ "album": { /* Album with visibility = private, publishedAt = null */ } }
```

---

### 8. Reorder Tracks
**POST** `/albums/:id/tracks/reorder`

**Request Body:**
```json
{
  "trackIds": ["uuid1", "uuid2", "uuid3"]  // New order
}
```

**Response: 200 OK**
```json
{ "tracks": [ /* Tracks with updated positions */ ] }
```

---

### 9. Add Track
**POST** `/albums/:id/tracks`

**Request Body:** (Track object without position)
```json
{
  "title": "string",
  "artists": [{ "name": "string" }],
  "duration": 240,
  "outboundLinks": [{ "platform": "spotify", "url": "https://...", "isPrimary": true }],
  "musicbrainzId": "string",
  "isrc": "string",
  "bpm": 128,
  "key": "8A"
}
```

**Response: 201 Created**
```json
{ "track": { /* Track with assigned position */ } }
```

---

### 10. Update Track
**PATCH** `/albums/:id/tracks/:trackId`

**Request Body:** (Partial Track)
```json
{
  "title": "string",
  "duration": 250,
  "outboundLinks": [...]
}
```

**Response: 200 OK**
```json
{ "track": { /* Updated Track */ } }
```

---

### 11. Delete Track
**DELETE** `/albums/:id/tracks/:trackId`

**Response: 204 No Content**

---

### 12. Get Album Analytics
**GET** `/albums/:id/analytics`

**Query Params:**
- `period` = `7d` | `30d` | `90d` | `all` (default: `30d`)

**Response: 200 OK**
```json
{
  "overview": { "plays": 1234, "uniqueListeners": 567, "saves": 89, "shares": 23 },
  "timeSeries": [
    { "date": "2026-01-01", "plays": 45, "listeners": 23 }
  ],
  "topSources": [
    { "source": "direct", "plays": 500 },
    { "source": "twitter", "plays": 300 },
    { "source": "search", "plays": 200 }
  ],
  "trackPerformance": [
    { "trackId": "uuid", "position": 1, "plays": 400, "completionRate": 0.85 }
  ],
  "geography": [
    { "country": "US", "plays": 600 },
    { "country": "UK", "plays": 200 }
  ],
  "devices": { "mobile": 0.65, "desktop": 0.3, "tablet": 0.05 }
}
```

---

### 13. Duplicate Album
**POST** `/albums/:id/duplicate`

**Request Body:**
```json
{
  "title": "New Title",
  "visibility": "private"
}
```

**Response: 201 Created**
```json
{ "album": { /* New album with copied tracks, notes, config */ } }
```

---

## Error Response Format

```json
{
  "error": "VALIDATION_FAILED",
  "message": "Album cannot be published",
  "details": {
    "blockers": [
      { "id": "album.has_cover_art", "message": "Cover art is required" },
      { "id": "album.has_tracks", "message": "At least one track is required" }
    ],
    "warnings": [
      { "id": "album.cover_art_quality", "score": 2, "message": "Cover art quality below threshold" }
    ]
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - 401
- `FORBIDDEN` - 403
- `NOT_FOUND` - 404
- `VALIDATION_FAILED` - 400
- `CONFLICT` - 409
- `RATE_LIMITED` - 429

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Create/Update/Delete | 60/min |
| List/Get | 120/min |
| Publish/Unpublish | 10/min |
| Analytics | 30/min |

---

## Webhooks

```typescript
type AlbumWebhookEvent =
  | 'album.created'
  | 'album.updated'
  | 'album.published'
  | 'album.unpublished'
  | 'album.deleted'
  | 'album.track_added'
  | 'album.track_updated'
  | 'album.track_deleted';

interface WebhookPayload {
  event: AlbumWebhookEvent;
  timestamp: string;
  albumId: string;
  curatorId: string;
  data: any;  // Event-specific
}
```

---

## Versioning

- Current: `v1`
- Header: `Accept: application/vnd.mixtape.v1+json`
- Deprecation: 6 months notice via `Deprecation` header