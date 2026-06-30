import { cookies } from "next/headers";
import {
  issueSessionStorage,
  lookupSessionStorage,
  revokeSessionStorage,
  SESSION_TTL_MS
} from "./auth-storage";
import { getCreator, type Creator } from "./stations";

const SESSION_COOKIE = "mixtape_session";

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function getCurrentCreator(): Promise<Creator | null> {
  const token = await getSessionToken();
  const session = await lookupSessionStorage(token);
  if (!session) return null;
  return (await getCreator(session.creatorId)) ?? null;
}

export async function requireCreator(): Promise<Creator> {
  const creator = await getCurrentCreator();
  if (!creator) {
    const error = new Error("Authentication required.") as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  return creator;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function revokeSession(token: string): Promise<void> {
  await revokeSessionStorage(token);
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function withCreator(
  handler: (creator: Creator) => Promise<Response> | Response
): Promise<Response> {
  try {
    const creator = await requireCreator();
    return await handler(creator);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return jsonError(status >= 500 ? "Server error" : (error as Error).message || "Server error", status);
  }
}
