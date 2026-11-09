export type PlaylistDetails = {
  creators: string[];
  genre: string;
  sourceUrl: string;
};

function invalid(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

/** Validate API inputs before storing metadata or rendering an outbound link. */
export function parsePlaylistDetails(input: Partial<PlaylistDetails>): Partial<PlaylistDetails> {
  const details: Partial<PlaylistDetails> = {};
  if (input.creators !== undefined) {
    if (!Array.isArray(input.creators) || input.creators.length > 20 ||
      input.creators.some((name) => typeof name !== "string" || name.length > 120)) {
      invalid("Provide up to 20 creator names, each at most 120 characters.");
    }
    details.creators = [...new Set(input.creators.map((name) => name.trim()).filter(Boolean))];
  }
  if (input.genre !== undefined) {
    if (typeof input.genre !== "string" || input.genre.length > 80) invalid("Genre must be at most 80 characters.");
    details.genre = input.genre.trim();
  }
  if (input.sourceUrl !== undefined) {
    if (typeof input.sourceUrl !== "string" || input.sourceUrl.length > 2048) invalid("Provide a valid playlist URL.");
    const value = input.sourceUrl.trim();
    if (value) {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) invalid("Use an http or https playlist URL without credentials.");
      } catch {
        invalid("Use an http or https playlist URL without credentials.");
      }
    }
    details.sourceUrl = value;
  }
  return details;
}
