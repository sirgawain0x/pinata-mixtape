/** Shared Lens text-post limit (UI + API). */
export const LENS_POST_MAX_CHARACTERS = 2000;

const POST_BODY_MAX_BYTES = 12_000;

export type LensPostValidation =
  | { ok: true; content: string }
  | { ok: false; status: number; message: string };

export function validateLensPostContent(content: unknown): LensPostValidation {
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, status: 400, message: `Write a post of up to ${LENS_POST_MAX_CHARACTERS.toLocaleString()} characters.` };
  }
  const trimmed = content.trim();
  if (trimmed.length > LENS_POST_MAX_CHARACTERS) {
    return {
      ok: false,
      status: 400,
      message: `Write a post of up to ${LENS_POST_MAX_CHARACTERS.toLocaleString()} characters.`,
    };
  }
  return { ok: true, content: trimmed };
}

export function lensPostBodyTooLarge(contentLengthHeader: number | null, bodyLength: number): boolean {
  const header = contentLengthHeader ?? 0;
  return header > POST_BODY_MAX_BYTES || bodyLength > POST_BODY_MAX_BYTES;
}
