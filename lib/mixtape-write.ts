import { getCurrentCreator } from "./auth";

type MixAuthShape = { creatorId?: number | null };

export type MixtapeWriterContext =
  | { kind: "public"; viewerCreatorId: number | null }
  | { kind: "trusted"; viewerCreatorId: number | null; isAdminToken: boolean };

/** Bearer token gates mix/song mutations when set (recommended in production). */
export function mixtapeAdminToken(): string | null {
  const t = process.env.MIXTAPE_WRITE_TOKEN?.trim();
  return t || null;
}

export async function authorizeMixtapeRequest(request: Request): Promise<MixtapeWriterContext> {
  const admin = mixtapeAdminToken();
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearer =
    authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  const viewer = await getCurrentCreator();
  const viewerCreatorId = viewer?.id ?? null;

  const isAdminToken = Boolean(admin && bearer && bearer === admin);

  const adminRequired = Boolean(admin);

  if (adminRequired && !isAdminToken && !viewerCreatorId) {
    const error = new Error("Mixtape edits require sign-in or a valid write token.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  if (!adminRequired) {
    return { kind: "public", viewerCreatorId };
  }

  return { kind: "trusted", viewerCreatorId, isAdminToken };
}

/** Returns true when the viewer may mutate this mix. */
export function canMutateMix(mix: MixAuthShape, ctx: MixtapeWriterContext): boolean {
  if (ctx.kind === "trusted" && ctx.isAdminToken) return true;
  const viewerId = ctx.viewerCreatorId;
  const adminSet = Boolean(mixtapeAdminToken());
  const ownedBy = mix.creatorId ?? null;

  if (ownedBy !== null && ownedBy !== undefined) {
    return viewerId !== null && viewerId === ownedBy;
  }

  if (!adminSet) return true;

  return false;
}
