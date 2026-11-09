# Mixtape TypeSafe Schema

## Overview
This document defines the TypeSafe (Jev) question schemas for validating and assessing Mixtape album pages and artist bios. Each question returns typed judgments with calibrated probabilities.

---

## 1. Album Page Validation Schema

### State Structure
```typescript
interface AlbumPageState {
  album: {
    id: string;
    title: string;
    slug: string;
    coverArt: { url: string; alt: string };
    djPersona: DJPersona;
    curator: UserProfile;
    tracks: Track[];
    setNotes: SetNotes;
    tags: string[];
    visibility: 'public' | 'unlisted' | 'private';
    releaseDate: string;
    licenses: LicenseInfo[];
    collaborators: UserProfile[];
    stats: { plays: number; saves: number; shares: number };
    broadcastConfig?: BroadcastConfig;
  };
  viewer: {
    isAuthenticated: boolean;
    isCurator: boolean;
    isCollaborator: boolean;
    canEdit: boolean;
  };
}
```

### Questions

#### A. Completeness Checks (Noul - Boolean Gates)

| Question ID | Question | True Criterion | False Criterion |
|-------------|----------|----------------|-----------------|
| `album.has_cover_art` | Does the album have cover art? | Cover art URL exists and is accessible | No cover art or broken URL |
| `album.has_tracks` | Does the album have at least one track? | Track array length > 0 | Empty track list |
| `album.has_description` | Does the album have a meaningful description? | Description > 50 chars, not placeholder text | Empty, < 50 chars, or "TODO" |
| `album.has_tags` | Does the album have discoverable tags? | At least 3 relevant tags | Fewer than 3 tags |
| `album.has_release_date` | Is the release date set and valid? | Valid ISO date, not in far future | Missing or invalid date |
| `album.tracks_have_metadata` | Do all tracks have MusicBrainz IDs? | Every track has `musicbrainzId` field | Any track missing MBID |
| `album.has_license_info` | Is licensing information present? | At least one license entry with type and URL | No licenses array or empty |

#### B. Quality Assessments (Score - Graded)

| Question ID | Question | Levels (1-5) |
|-------------|----------|--------------|
| `album.cover_art_quality` | How well does the cover art represent the mixtape's mood? | 1: Generic/placeholder • 2: Loosely related • 3: Represents genre • 4: Strong visual identity • 5: Iconic, instantly recognizable |
| `album.description_depth` | How rich is the album description/story? | 1: One sentence • 2: Basic context • 3: Good narrative • 4: Compelling story with context • 5: Immersive, handwritten-note quality |
| `album.curation_coherence` | How coherent is the track sequencing and energy arc? | 1: Random order • 2: Loose theme • 3: Clear arc • 4: Expert pacing • 5: Masterful journey |
| `album.metadata_completeness` | How complete is the track metadata (ISRC, credits, BPM, key)? | 1: Title only • 2: Title + artist • 3: + ISRC/MBID • 4: + BPM/key/credits • 5: Full MusicBrainz parity |

#### C. Discovery & Growth (Choice - Classification)

| Question ID | Question | Options |
|-------------|----------|---------|
| `album.primary_mood` | What is the primary mood of this mixtape? | `chill`, `energetic`, `melancholic`, `uplifting`, `dark`, `romantic`, `nostalgic`, `experimental`, `other` |
| `album.target_context` | What is the intended listening context? | `rooftop_warmup`, `late_night_drive`, `gym_session`, `study_focus`, `party_starter`, `wind_down`, `commute`, `other` |
| `album.genre_cluster` | Which genre cluster best describes this mix? | `electronic`, `hip_hop`, `indie`, `ambient`, `jazz`, `classical`, `world`, `experimental`, `multi_genre` |

#### D. Broadcast Readiness (Noul + Score)

| Question ID | Question | Type |
|-------------|----------|------|
| `album.broadcast_eligible` | Does this album meet broadcast station requirements? | Noul (true: ≥10 tracks, ≥60min, licensed, scheduled) |
| `album.broadcast_polish_score` | How polished is the broadcast configuration? | Score (1-5: schedule, exclusives, ads, token config) |

---

## 2. Artist Bio Validation Schema

### State Structure
```typescript
interface ArtistBioState {
  artist: {
    id: string;
    handle: string;
    displayName: string;
    avatar: { url: string; alt: string };
    headerImage?: { url: string };
    oneLiner: string;
    originStory: string;
    philosophy: string;
    signatureSound: string[];
    notableMixtapes: MixtapeRef[];
    broadcastSchedule?: BroadcastSchedule;
    stats: { followers: number; totalPlays: number; featuredCount: number };
    socialLinks: { platform: string; url: string }[];
    monetization: {
      meToken?: TokenConfig;
      revenueSplits: CollaboratorSplit[];
      exclusiveTiers: ExclusiveTier[];
      sponsorshipRates: SponsorshipRate[];
    };
  };
  viewer: { isAuthenticated: boolean; isFollowing: boolean; isArtist: boolean };
}
```

### Questions

#### A. Identity Completeness (Noul)

| Question ID | Question | True Criterion | False Criterion |
|-------------|----------|----------------|-----------------|
| `artist.has_handle` | Does the artist have a valid handle? | Alphanumeric + underscore, 3-30 chars, unique | Missing, invalid format, or taken |
| `artist.has_display_name` | Is there a display name? | Non-empty, ≤ 50 chars | Empty or too long |
| `artist.has_avatar` | Is there an avatar image? | Valid image URL, accessible | Missing or broken |
| `artist.has_one_liner` | Is there a one-liner bio? | 10-160 chars, descriptive | Missing, too short, or generic |
| `artist.has_origin_story` | Is the origin story filled out? | > 200 chars, personal narrative | Missing or placeholder |
| `artist.has_philosophy` | Is the curation philosophy stated? | > 100 chars, specific POV | Missing or "I like good music" |
| `artist.has_signature_sound` | Are signature genres/moods listed? | At least 3 specific entries | Fewer than 3 or generic tags |

#### B. Social Proof & Authority (Score)

| Question ID | Question | Levels (1-5) |
|-------------|----------|--------------|
| `artist.bio_narrative_quality` | How compelling is the artist's narrative? | 1: Bare bones • 2: Functional • 3: Engaging • 4: Memorable • 5: Inspiring, builds connection |
| `artist.authority_signals` | How strong are the authority signals? | 1: New, no features • 2: Some plays • 3: Featured once • 4: Regular features • 5: Tastemaker, cited by others |
| `artist.cross_platform_presence` | How established is the cross-platform presence? | 1: Mixtape only • 2: +1 platform • 3: +2 platforms • 4: Strong multi-platform • 5: Omnipresent |

#### C. Monetization Readiness (Choice + Noul)

| Question ID | Question | Type | Options/Criteria |
|-------------|----------|------|------------------|
| `artist.me_token_status` | What is the meToken status? | Choice | `not_started`, `configured`, `deployed`, `active_trading` |
| `artist.has_exclusive_tiers` | Are subscriber tiers configured? | Noul | At least one tier with benefits and price |
| `artist.sponsorship_ready` | Is the artist ready for sponsorships? | Noul | Rates defined + media kit + 10k+ followers |

---

## 3. TypeSafe Request Payloads

### Album Validation Request
```json
{
  "state": { "album": {...}, "viewer": {...} },
  "questions": [
    { "id": "album.has_cover_art", "type": "noul", "criteria": { "true": "Cover art URL exists and returns 200", "false": "No cover art or broken URL" } },
    { "id": "album.has_tracks", "type": "noul", "criteria": { "true": "Track array length > 0", "false": "Empty track list" } },
    { "id": "album.cover_art_quality", "type": "score", "levels": { "1": "Generic/placeholder", "2": "Loosely related", "3": "Represents genre", "4": "Strong visual identity", "5": "Iconic, instantly recognizable" } },
    { "id": "album.primary_mood", "type": "choice", "options": ["chill", "energetic", "melancholic", "uplifting", "dark", "romantic", "nostalgic", "experimental", "other"] }
  ]
}
```

### Artist Bio Validation Request
```json
{
  "state": { "artist": {...}, "viewer": {...} },
  "questions": [
    { "id": "artist.has_handle", "type": "noul", "criteria": { "true": "Valid handle format, unique", "false": "Missing, invalid, or taken" } },
    { "id": "artist.bio_narrative_quality", "type": "score", "levels": { "1": "Bare bones", "2": "Functional", "3": "Engaging", "4": "Memorable", "5": "Inspiring" } },
    { "id": "artist.me_token_status", "type": "choice", "options": ["not_started", "configured", "deployed", "active_trading"] }
  ]
}
```

---

## 4. Integration Patterns

### Client-Side Validation (On Save)
```typescript
async function validateAlbumOnSave(album: Album) {
  const result = await typesafe.ask({
    state: buildAlbumState(album),
    questions: ALBUM_VALIDATION_QUESTIONS
  });

  const blockers = result.answers
    .filter(a => a.type === 'noul' && a.value === false)
    .map(a => a.id);

  const warnings = result.answers
    .filter(a => a.type === 'score' && a.value < 3)
    .map(a => ({ id: a.id, score: a.value }));

  return { blockers, warnings, passed: blockers.length === 0 };
}
```

### Publish Gate
```typescript
async function canPublishAlbum(album: Album): boolean {
  const { blockers } = await validateAlbumOnSave(album);
  return blockers.length === 0;
}
```

### Discovery Ranking Features
```typescript
// Use TypeSafe answers as features for ranking
const discoveryFeatures = {
  mood: answers.find(a => a.id === 'album.primary_mood')?.value,
  coherence: answers.find(a => a.id === 'album.curation_coherence')?.value,
  metadataScore: answers.find(a => a.id === 'album.metadata_completeness')?.value,
  curatorAuthority: answers.find(a => a.id === 'artist.authority_signals')?.value
};
```

---

## 5. Thresholds & Gates

| Gate | Required Answers | Threshold |
|------|------------------|-----------|
| **Save Draft** | All Noul completeness | All `true` |
| **Publish Public** | Save Draft + Quality | All Noul `true` + all Score ≥ 3 |
| **Broadcast Enable** | Publish Public + Broadcast | Broadcast Noul `true` + Score ≥ 4 |
| **Monetization Enable** | Publish Public + Monetization | meToken `deployed` + Exclusive tiers Noul `true` |

---

## 6. References

- TypeSafe Docs: https://docs.typesafe.ai/llms.txt
- Primitives: https://docs.typesafe.ai/go/primitives.md
- Cookbooks: https://docs.typesafe.ai/go/cookbooks.md
- Models: https://docs.typesafe.ai/go/models.md
