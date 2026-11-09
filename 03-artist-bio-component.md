# Mixtape Artist Bio Component Design

## Overview
React/Next.js component specification for the Artist Bio page and profile card. Built for the Mixtape app at `mixtape.creativeplatform.xyz/app`.

---

## Component Hierarchy

```
ArtistProfilePage
├── ArtistHeader
│   ├── Avatar
│   ├── HeaderImage
│   ├── IdentityBadges (verified, station, token)
│   └── FollowButton
├── ArtistBio
│   ├── OneLiner
│   ├── OriginStory
│   ├── Philosophy
│   └── SignatureSound
├── ArtistStats
│   ├── Followers
│   ├── TotalPlays
│   ├── FeaturedCount
│   └── MixtapeCount
├── SocialLinks
├── NotableMixtapes
│   └── MixtapeCard[]
├── BroadcastSchedule (conditional)
│   └── ScheduleGrid
├── MonetizationPanel (conditional, artist-only)
│   ├── MeTokenStatus
│   ├── ExclusiveTiers
│   └── SponsorshipRates
└── Collaborations
    └── CollaboratorCard[]
```

---

## 1. ArtistHeader Component

### Props
```typescript
interface ArtistHeaderProps {
  artist: {
    id: string;
    handle: string;
    displayName: string;
    avatar: ImageAsset;
    headerImage?: ImageAsset;
    badges: Badge[];
    stats: { followers: number; isFollowing: boolean };
  };
  viewer: { isAuthenticated: boolean; isArtist: boolean };
  onFollow: () => Promise<void>;
  onEditProfile: () => void;
}
```

### Badges
| Badge | Condition | Visual |
|-------|-----------|--------|
| `verified` | Platform-verified curator | Blue checkmark |
| `station` | Has active broadcast station | Radio wave icon |
| `token` | meToken deployed | Diamond icon |
| `creator_pass` | Creative Pass subscriber | Gradient badge |
| `pro_pass` | Creative Professional Pass | Gold badge |

### Layout (Desktop)
```
┌─────────────────────────────────────────────────────────────┐
│  [Header Image - full width, 200px height, object-cover]   │
├─────────────────────────────────────────────────────────────┤
│  [Avatar 120px]  @handle  Display Name  [Badges...]        │
│                  One-liner (truncated to 2 lines)          │
│                  [Follow] [Message] [Share]  [Edit Profile]│
│                  Followers: 12.3K  •  Mixtapes: 47  •  2.1M plays
└─────────────────────────────────────────────────────────────┘
```

### Layout (Mobile)
```
┌─────────────────────────────┐
│  [Header Image - 16:9]      │
├─────────────────────────────┤
│  [Avatar 80px]              │
│  @handle  Display Name      │
│  [Badges]                   │
│  One-liner                  │
│  [Follow] [Message] [Share] │
│  12.3K followers • 47 tapes │
└─────────────────────────────┘
```

---

## 2. ArtistBio Component

### Props
```typescript
interface ArtistBioProps {
  bio: {
    oneLiner: string;
    originStory: string;
    philosophy: string;
    signatureSound: string[];
  };
  isEditing: boolean;
  onSave: (bio: BioData) => Promise<void>;
  onCancel: () => void;
}
```

### Sections

#### A. One-Liner
- **Display:** Large, prominent text under header
- **Max Length:** 160 chars
- **Edit Mode:** Single-line input with char counter
- **Empty State:** "Add a one-liner that captures your vibe"

#### B. Origin Story
- **Display:** Rich text (markdown rendered)
- **Max Length:** 5000 chars
- **Edit Mode:** Textarea with markdown toolbar
- **Placeholder:** "How did you start curating? What was your first mixtape moment?"

#### C. Philosophy
- **Display:** Rich text
- **Max Length:** 2000 chars
- **Edit Mode:** Textarea
- **Placeholder:** "What's your curation philosophy? 'Never send a playlist without a point of view.'"

#### D. Signature Sound
- **Display:** Horizontal scrolling chips/tags
- **Max Items:** 15
- **Edit Mode:** Tag input with autocomplete from genre/mood taxonomy
- **Suggestions:** Based on artist's mixtape tags + global taxonomy

---

## 3. ArtistStats Component

### Props
```typescript
interface ArtistStatsProps {
  stats: {
    followers: number;
    totalPlays: number;
    featuredCount: number;
    mixtapeCount: number;
    avgCompletionRate: number;
  };
  trend?: { period: '7d' | '30d'; followersDelta: number; playsDelta: number };
}
```

### Visual
```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ 12.3K   │ │ 2.1M    │ │   12    │ │   47    │
│Followers│ │ Plays   │ │Featured │ │Mixtapes │
│  +2.1%  │ │ +5.3%   │ │         │ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### Format Rules
- ≥ 1M: `1.2M`
- ≥ 100K: `123K`
- ≥ 10K: `12.3K`
- < 10K: `1,234`

---

## 4. SocialLinks Component

### Props
```typescript
interface SocialLinksProps {
  links: { platform: string; url: string; verified: boolean }[];
  onAdd: () => void;
  onRemove: (platform: string) => void;
  isEditing: boolean;
}
```

### Supported Platforms
| Platform | Icon | URL Pattern |
|----------|------|-------------|
| twitter/x | X logo | `https://x.com/*` |
| instagram | Camera | `https://instagram.com/*` |
| tiktok | Music note | `https://tiktok.com/@*` |
| youtube | Play button | `https://youtube.com/@*` |
| soundcloud | Cloud | `https://soundcloud.com/*` |
| spotify | Green circle | `https://open.spotify.com/user/*` |
| website | Globe | Any valid URL |
| email | Envelope | `mailto:*` |
| discord | Gamepad | `https://discord.gg/*` |
| telegram | Paper plane | `https://t.me/*` |

### Display
- Icon + platform name (truncated on mobile)
- Verified badge (blue check) for claimed links
- Hover: Show full URL tooltip
- Edit mode: Drag to reorder, delete button

---

## 5. NotableMixtapes Component

### Props
```typescript
interface NotableMixtapesProps {
  mixtapes: MixtapeRef[];
  onSelect: (mixtapeId: string) => void;
  limit?: number;  // Default 6, "Show all" expands
}
```

### MixtapeRef
```typescript
interface MixtapeRef {
  id: string;
  slug: string;
  title: string;
  coverArt: ImageAsset;
  djPersona: DJPersonaRef;
  stats: { plays: number; saves: number };
  releaseDate: string;
  isPublished: boolean;
}
```

### Card Layout
```
┌─────────────────────────────────────┐
│  [Cover 1:1]  Title                 │
│             Velvet Static • 2.3K ▶  │
│             Jan 15, 2026  •  45 min │
└─────────────────────────────────────┘
```

### Empty State
> "No mixtapes yet. Create your first mixtape to start building your catalog."

---

## 6. BroadcastSchedule Component

### Props
```typescript
interface BroadcastScheduleProps {
  schedule: BroadcastScheduleEntry[];
  timezone: string;  // IANA tz, e.g., "America/Los_Angeles"
  onEdit: () => void;  // Artist only
}
```

### ScheduleEntry
```typescript
interface BroadcastScheduleEntry {
  dayOfWeek: 0-6;
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  mixtape: MixtapeRef;
  isLive: boolean;
  isRecurring: boolean;
}
```

### Visual (Week Grid)
```
┌──────────────────────────────────────────────────────────┐
│  Mon  │  Tue  │  Wed  │  Thu  │  Fri  │  Sat  │  Sun    │
├───────┼───────┼───────┼───────┼───────┼───────┼─────────┤
│       │ 18:00 │       │ 18:00 │       │ 20:00 │         │
│       │ LIVE  │       │ LIVE  │       │  Wknd │         │
│       │ Night │       │ Deep  │       │ Vibes │         │
│       │ Drive │       │ Cuts  │       │       │         │
└───────┴───────┴───────┴───────┴───────┴───────┴─────────┘
```

### Time Display
- Show in viewer's local timezone (detected via `Intl.DateTimeFormat`)
- Indicate "LIVE" badge for `isLive: true`
- Click mixtape → navigate to mixtape page

---

## 7. MonetizationPanel Component (Artist Only)

### Props
```typescript
interface MonetizationPanelProps {
  monetization: {
    meToken: MeTokenStatus;
    exclusiveTiers: ExclusiveTier[];
    sponsorshipRates: SponsorshipRate[];
    revenueSplits: CollaboratorSplit[];
  };
  onConfigureToken: () => void;
  onManageTiers: () => void;
  onSetRates: () => void;
}
```

### MeTokenStatus
```typescript
type MeTokenStatus =
  | { status: 'not_started' }
  | { status: 'configured'; config: TokenConfig }
  | { status: 'deployed'; contractAddress: string; txHash: string }
  | { status: 'active_trading'; price: number; volume24h: number; holders: number };
```

### Visual States

#### Not Started
```
┌────────────────────────────────────┐
│  💎  Launch Your meToken           │
│  Turn your influence into economy  │
│  [Configure Token]                 │
└────────────────────────────────────┘
```

#### Configured (Pre-deploy)
```
┌────────────────────────────────────┐
│  💎  meToken Ready to Deploy       │
│  Name: $VIBE  •  Supply: 1M        │
│  [Review & Deploy]  [Edit Config]  │
└────────────────────────────────────┘
```

#### Deployed
```
┌────────────────────────────────────┐
│  💎  $VIBE  •  0x1234...5678       │
│  Price: $0.42  │  24h Vol: $12.3K  │
│  Holders: 1,234  │  Market Cap: $420K│
│  [View on Explorer] [Manage]       │
└────────────────────────────────────┘
```

### ExclusiveTiers
```typescript
interface ExclusiveTier {
  id: string;
  name: string;
  priceMonthly: number;  // USD cents
  benefits: string[];    // e.g., ["Early access", "Exclusive mixes", "Discord role"]
  subscriberCount: number;
  color: string;  // Hex for gradient
}
```

### Tier Card
```
┌────────────────────────────────────┐
│  ◈  VIP ACCESS        $10/mo       │
│  ────────────────────────────────  │
│  ✓ Early access to new mixtapes    │
│  ✓ Exclusive monthly mix           │
│  ✓ Private Discord channel         │
│  ✓ 10% off merch                   │
│  ────────────────────────────────  │
│  234 subscribers  •  $2,340 MRR    │
│  [Edit] [Manage Subscribers]       │
└────────────────────────────────────┘
```

### SponsorshipRates
```typescript
interface SponsorshipRate {
  type: 'pre_roll' | 'mid_roll' | 'post_roll' | 'voice_clone' | 'banner' | 'shoutout';
  price: number;  // USD cents
  duration?: string;  // e.g., "30 seconds"
  inventory: number;  // Slots per month
  sold: number;
}
```

### Rates Table
```
┌────────────────────────────────────────────────────┐
│  SPONSORSHIP RATES                    [Edit Rates] │
├──────────────┬──────────┬──────────┬───────────────┤
│  Type        │ Price    │ Duration │ Availability  │
├──────────────┼──────────┼──────────┼───────────────┤
│  Pre-roll    │ $500     │ 30s      │ 4/8 this month│
│  Mid-roll    │ $750     │ 60s      │ 2/4 this month│
│  Voice Clone │ $1,500   │ 60s      │ 1/2 this month│
│  Shoutout    │ $250     │ 15s      │ 6/10 this month│
└──────────────┴──────────┴──────────┴───────────────┘
```

---

## 8. Collaborations Component

### Props
```typescript
interface CollaborationsProps {
  collaborators: Collaborator[];
  onViewProfile: (userId: string) => void;
}

interface Collaborator {
  user: UserRef;
  role: 'co_curator' | 'featured_artist' | 'producer' | 'designer' | 'writer';
  mixtapeCount: number;
  revenueShare?: number;
}
```

### Card
```
┌─────────────────────────────────────────────┐
│  [Avatar]  @username  Display Name          │
│  Co-curator  •  12 mixtapes together        │
│  15% revenue share                          │
└─────────────────────────────────────────────┘
```

---

## 9. ArtistProfilePage Assembly

### Route
```
/app/u/:handle
```

### Data Fetching (Server Component)
```typescript
async function getArtistProfile(handle: string, viewerId?: string) {
  const artist = await db.artist.findUnique({
    where: { handle },
    include: {
      stats: true,
      bio: true,
      socialLinks: true,
      mixtapes: { where: { visibility: 'public' }, take: 6, orderBy: { publishedAt: 'desc' } },
      broadcastSchedule: true,
      monetization: viewerId === artist.id ? true : false,
      collaborations: true,
    }
  });

  if (!artist) throw new NotFoundError();

  const isFollowing = viewerId
    ? await db.follow.exists({ followerId: viewerId, followingId: artist.id })
    : false;

  return { artist, viewer: { isAuthenticated: !!viewerId, isArtist: viewerId === artist.id, isFollowing } };
}
```

### Page Layout
```
<ArtistProfilePage>
  <ArtistHeader artist={artist} viewer={viewer} />
  <main className="grid lg:grid-cols-[1fr_320px] gap-8 p-6 max-w-7xl mx-auto">
    <section className="space-y-8">
      <ArtistBio bio={artist.bio} isEditing={viewer.isArtist} />
      <SocialLinks links={artist.socialLinks} isEditing={viewer.isArtist} />
      <NotableMixtapes mixtapes={artist.mixtapes} />
      {artist.broadcastSchedule?.length && (
        <BroadcastSchedule schedule={artist.broadcastSchedule} />
      )}
      <Collaborations collaborators={artist.collaborations} />
    </section>
    <aside className="space-y-6 sticky top-24">
      <ArtistStats stats={artist.stats} />
      {viewer.isArtist && (
        <MonetizationPanel monetization={artist.monetization} />
      )}
    </aside>
  </main>
</ArtistProfilePage>
```

---

## 10. Profile Card (Compact - for Mixtape Pages, Search, Recommendations)

### Props
```typescript
interface ArtistProfileCardProps {
  artist: {
    id: string;
    handle: string;
    displayName: string;
    avatar: ImageAsset;
    oneLiner: string;
    stats: { followers: number; mixtapeCount: number };
    badges: Badge[];
  };
  variant: 'default' | 'compact' | 'minimal';
  onFollow?: () => void;
}
```

### Variants

#### Default (Mixtape page sidebar)
```
┌────────────────────────────────────┐
│  [Avatar 48px]  @handle  Name      │
│  One-liner (1 line, truncated)     │
│  [Badges]                          │
│  12.3K followers  •  47 mixtapes   │
│  [Follow]                          │
└────────────────────────────────────┘
```

#### Compact (Search results)
```
┌────────────────────────────────────┐
│  [Avatar 32px] @handle  Name  [Follow]  12.3K followers
└────────────────────────────────────┘
```

#### Minimal (Mixtape track credits)
```
@handle  [Follow]
```

---

## 11. TypeScript Types Export

```typescript
// types/artist.ts
export interface ArtistProfile {
  id: string;
  handle: string;
  displayName: string;
  avatar: ImageAsset;
  headerImage?: ImageAsset;
  oneLiner: string;
  originStory: string;
  philosophy: string;
  signatureSound: string[];
  stats: ArtistStats;
  badges: Badge[];
  socialLinks: SocialLink[];
  mixtapes: MixtapeRef[];
  broadcastSchedule?: BroadcastScheduleEntry[];
  monetization?: MonetizationData;
  collaborations: Collaborator[];
}

export interface ArtistStats {
  followers: number;
  totalPlays: number;
  featuredCount: number;
  mixtapeCount: number;
  avgCompletionRate: number;
}

export type Badge =
  | 'verified'
  | 'station'
  | 'token'
  | 'creator_pass'
  | 'pro_pass'
  | 'brand_pass';

export interface SocialLink {
  platform: Platform;
  url: string;
  verified: boolean;
}

export type Platform =
  | 'twitter' | 'instagram' | 'tiktok' | 'youtube'
  | 'soundcloud' | 'spotify' | 'website' | 'email'
  | 'discord' | 'telegram';

export interface MonetizationData {
  meToken: MeTokenStatus;
  exclusiveTiers: ExclusiveTier[];
  sponsorshipRates: SponsorshipRate[];
  revenueSplits: CollaboratorSplit[];
}
```

---

## 12. Accessibility

- All interactive elements: `tabIndex`, `aria-label`, focus visible
- Avatar: `alt="Display Name avatar"`
- Stats: `aria-label="12.3K followers"`
- Badges: `aria-label="Verified curator"`
- Follow button: `aria-pressed` for toggle state
- Edit modes: `aria-expanded` on section headers
- Color contrast: WCAG AA minimum (4.5:1)

---

## 13. Responsive Breakpoints

| Breakpoint | Header | Bio | Sidebar |
|------------|--------|-----|---------|
| `< 640px` | Stacked, avatar 80px | Full width, stacked | Below main, collapsed |
| `640-1024px` | Side-by-side | Full width | Right sidebar, sticky |
| `> 1024px` | Side-by-side | 2/3 width | Right sidebar, sticky |

---

## 14. State Management

```typescript
// hooks/useArtistProfile.ts
export function useArtistProfile(handle: string) {
  const { data, mutate } = useSWR(`/api/v1/mixtape/artists/${handle}`);

  const follow = useCallback(async () => {
    await fetch(`/api/v1/mixtape/artists/${handle}/follow`, { method: 'POST' });
    mutate();
  }, [handle, mutate]);

  const updateBio = useCallback(async (bio: Partial<BioData>) => {
    await fetch(`/api/v1/mixtape/artists/${handle}/bio`, {
      method: 'PATCH',
      body: JSON.stringify(bio)
    });
    mutate();
  }, [handle, mutate]);

  return { artist: data, follow, updateBio, isLoading: !data };
}
```

---

## 15. API Endpoints (Artist)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/mixtape/artists/:handle` | Get public profile |
| GET | `/api/v1/mixtape/artists/:handle/me` | Get own profile (with monetization) |
| PATCH | `/api/v1/mixtape/artists/:handle` | Update profile (avatar, header, bio) |
| PATCH | `/api/v1/mixtape/artists/:handle/bio` | Update bio sections |
| POST | `/api/v1/mixtape/artists/:handle/follow` | Follow/unfollow |
| GET | `/api/v1/mixtape/artists/:handle/mixtapes` | List artist's mixtapes |
| GET | `/api/v1/mixtape/artists/:handle/analytics` | Artist analytics (owner only) |
| POST | `/api/v1/mixtape/artists/:handle/token/configure` | Configure meToken |
| POST | `/api/v1/mixtape/artists/:handle/token/deploy` | Deploy meToken |
| PATCH | `/api/v1/mixtape/artists/:handle/tiers` | Update exclusive tiers |
| PATCH | `/api/v1/mixtape/artists/:handle/sponsorship-rates` | Update sponsorship rates |

---

## 16. Design Tokens

```css
:root {
  --artist-avatar-sm: 32px;
  --artist-avatar-md: 48px;
  --artist-avatar-lg: 80px;
  --artist-avatar-xl: 120px;
  --artist-header-height: 200px;
  --artist-header-height-mobile: 160px;
  --artist-badge-size: 24px;
  --artist-stat-card-padding: 16px;
  --artist-section-gap: 32px;
  --artist-sidebar-width: 320px;
}
```
