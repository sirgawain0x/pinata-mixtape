import type { Mix } from "./mixtapes";

export function canViewMix(mix: Mix, viewerCreatorId: number | null): boolean {
  if (mix.isPublic) return true;
  if (viewerCreatorId !== null && mix.creatorId !== null && mix.creatorId === viewerCreatorId) {
    return true;
  }
  return false;
}
