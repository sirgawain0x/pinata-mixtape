export const LENS_ACCOUNT_GET_SIGN_IN_MESSAGE = "Sign in to view Lens account links.";

export function requireSignedInForLensAccountLookup(viewerPresent: boolean): { status: 401; message: string } | null {
  return viewerPresent ? null : { status: 401, message: LENS_ACCOUNT_GET_SIGN_IN_MESSAGE };
}
