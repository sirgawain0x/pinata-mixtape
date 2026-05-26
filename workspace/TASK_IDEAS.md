# Task Ideas

- Rebuild a new weekly discovery tape from the user's favorite artists and recent timeline moments.
- Generate a party arc for a specific duration and crowd size.
- Turn a memory like "what was playing at that club?" into a reconstruction task.
- Add MusicBrainz enrichment for artists, releases, and canonical IDs.
- Use MusicBrainz lookup during song ingestion to suggest canonical recording pages before saving.
- Generate public share pages with cleaner outbound listening links and artist support links. (Implemented: `/app/m/{slug}`.)
- Import a saved mix into a station with `POST /app/api/stations/:id/segments/import-mix`.
- Call `POST /app/api/agent/suggestions` before proposing curations or broadcast changes.
- Add event templates such as dinner, drive, workout, afters, and opening set.
