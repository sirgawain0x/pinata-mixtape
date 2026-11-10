# Mixtape UI build — phase 1

TL;DR: `/app` now uses the supplied mobile design language for discovery, My page, playlist browsing, creation, and the cassette player. It uses the existing data and authentication. The marketing page at `/` is unchanged.

## Implemented

- White surfaces, pink/peach gradients, rounded playlist and track cards, responsive navigation, and a logo extracted from the supplied design PDF. Typography covers represent real playlists without artwork; sample celebrity art and invented engagement totals are not seeded.
- Homepage, all playlists, tracks, My page, and public creator views. My page filters playlists and tracks by the signed-in creator. Profile name and bio updates use the existing authenticated API.
- Playlist detail with a responsive cassette, active-track highlighting, track selection, continuous queue playback, sharing, and links to the existing studio and broadcast functionality.
- Bottom search sheet using the existing crate match behavior. Song results must belong to a visible matching mix, so the sheet does not reveal tracks from private mixes.
- Agent-first playlist creation, with a form fallback. The assistant asks for details and uses a read-only MusicBrainz tool. It returns a draft; review and save happen through the existing editor and ownership checks.
- Creators, genre, and source URL on playlists; release date and album/release title on tracks. Existing metadata survives editor saves. SQLite and Turso/libSQL receive additive, repeatable migrations.

## Routes

- `/app`: discovery
- `/app?page=me`: signed-in creator's page
- `/app?page=profile&creator=<id>`: public creator view
- `/app?page=playlists`: playlist grid
- `/app?page=tracks`: visible playlist tracks
- `/app?mix=<id>&track=<zero-based index>`: cassette and tracklist
- `/app?mix=<id>&view=studio` or `view=broadcast`: original studio/deck
- `POST /app/api/agent/create-playlist`: signed-in assistant; drafts only

## Runtime

The assistant uses AI SDK 7 on Node.js 22+, through AI Gateway. `AI_GATEWAY_MODEL` can override the default live-catalog model. Vercel uses its OIDC token; self-hosted deployments need `AI_GATEWAY_API_KEY`. Refresh local OIDC credentials with Vercel CLI when expired. Keep credentials out of source control.

Requests require a creator session and have bounded conversation length, output size, steps, and MusicBrainz lookups. The per-process rate limiter is a backstop; use platform limits when exposing the assistant at scale. Source URLs are stored as outbound links, not fetched or imported. MusicBrainz can return multiple versions or compilation releases; users should review matches and supply legal playback links. AI does not invent playable media URLs.

## Still outside phase 1

Native Mixtape posts, hype and tipping, new Live creation, brand collaborations, trade accounts/campaigns, follower totals, and the proposed Twitch/recovery auth changes. The Post entry now opens an external composer flow: X / Twitter is primary, with Lens via Hey as the secondary option. Native Mixtape posts and engagement are still outside this phase. Existing stations remain available through On Air and the creator studio. Existing Privy email/Google/wallet sign-in is preserved; this differs from the draft's description of the older Account Kit-only flow.

## Checks

`npm run typecheck`, `npm run test:mixtape`, and `npm run build`. Tests use temporary local databases and cover legacy migrations in SQLite and libSQL, metadata round trips and clearing, song metadata preservation, private visibility and visible-only song links/counts, URL validation, and bounded assistant input. Live assistant checks are separate from automated tests to avoid spending credits on every test run.

## Verification record

- Five automated tests passed; type checking passed.
- A live AI Gateway request produced a playlist draft, and a second request returned a real MusicBrainz recording with release metadata.
- Browser checks at 390px and desktop width covered search-to-playlist navigation, cassette sizing, direct track selection, animation/active row, automatic advance with local test audio, agent-first entry, form fallback, saving and reading back metadata, and signed-out My page. Generated verification playlists and media were removed.
- Unauthenticated assistant requests returned HTTP 401. No user login or signed-in profile-edit browser test was performed.
- Production compilation succeeds with existing Privy optional-module warnings for `@stripe/crypto` and `@farcaster/mini-app-solana`. Those optional payment/Solana integrations were not changed.


## External posting — November 6 update

The Post toolbar button opens a shared text draft with X / Twitter selected first and Lens via Hey second. Users may attach a public playlist on a deployed HTTPS site. Private playlists are excluded; local preview links cannot be attached. Opening a destination preserves the draft in the open Mixtape dialog and does not record a published post, create a local feed entry, or claim a successful remote publication. Users review, sign in, add media if desired, and publish in the destination composer. Copy post is available if a platform loses draft text during sign-in.

No social API key, account delegation, or automatic posting is used. This follows the user's choice to open platform composers. No new backend service is required.

Sources checked: [X's post button help](https://help.x.com/en/using-x/add-x-share-button) and [Hey NewPost source](https://github.com/heyxyz/hey/blob/main/src/components/Composer/NewPost.tsx). X's intent URL redirects to login with the draft preserved in `redirect_after_login`; Hey opens its account/login flow. Authenticated publication and Lens prefill after sign-in were not tested; no external post was published.

Validation: `npm run test:social` covers destination URLs, text/Unicode encoding, draft formatting, private playlist exclusion, and rejection of local links. Existing playlist tests and production build also remain part of the checks.

Browser verification for the posting update passed on desktop and at 390px: default X selection, switching to Lens without losing draft text, live preview, encoded destination links, Copy post, X launch status, empty-draft disabling, and no horizontal overflow. Nine automated tests and the production build passed. Existing Privy optional-module warnings remain.

## Official Lens reference

[Official Lens documentation bundle](https://lens.xyz/docs/llms.txt), reviewed November 6, 2026. Relevant sections: protocol/authentication, protocol/feeds/post, and protocol/getting-started/typescript. Native Lens publishing requires an authenticated account owner/manager, publicly hosted post metadata, and a post action through the Lens API/SDK. The bundle also documents audio, image, video, and livestream metadata.

The reviewed bundle does not document a universal external composer URL. The current Hey handoff is based on Hey's own implementation, not a Lens SDK contract. Keep the user's selected external-composer flow; native Lens publishing would be a separate integration.
