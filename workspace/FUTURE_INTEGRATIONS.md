# Future Integrations

Use this file to track provider ideas that are useful but not part of the phase-one build.

## Current Phase

Right now the product supports:

- MusicBrainz for canonical metadata lookup
- direct YouTube URLs when the user provides them
- ad hoc YouTube mix embeds when enough direct track URLs exist

Phase one does not include authenticated provider integrations or account-linked playlist creation.

## Spotify

Possible later features:

- store `spotifyUrl` per song
- render Spotify track embeds
- add authenticated playlist export

Constraints:

- requires provider-specific IDs and usually user auth for playlist creation
- playback and account actions are governed by Spotify platform rules

## Apple Music

Possible later features:

- store `appleMusicUrl` per song
- render Apple Music embeds or MusicKit-driven playback

Constraints:

- more setup than plain outbound linking
- auth and playback rules are different from YouTube embeds

## Bandcamp

Possible later features:

- store `bandcampUrl`
- prefer artist-supporting outbound links when available

Constraints:

- embedding and link formats vary by release and page

## SoundCloud

Possible later features:

- store `soundcloudUrl`
- render SoundCloud embeds for supported tracks

Constraints:

- embed support is good, but canonical metadata is weaker than MusicBrainz

## Suggested Data Model Additions

If provider expansion happens later, songs should likely grow these optional fields:

- `spotifyUrl`
- `appleMusicUrl`
- `bandcampUrl`
- `soundcloudUrl`

Keep them optional. Do not fabricate provider URLs without a verified source.

## Rule Of Thumb

- MusicBrainz is for identity.
- Provider URLs are for listening.
- Direct URLs should come from the user or a verified enrichment step.
- Do not guess provider links and present them as authoritative.
