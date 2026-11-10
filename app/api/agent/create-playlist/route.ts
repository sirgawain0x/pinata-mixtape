import { isAiGatewayConfigured } from "../../../../lib/ai-gateway";
import { getCurrentCreator } from "../../../../lib/auth";
import { createPlaylistDraft, playlistConversationSchema } from "../../../../lib/playlist-agent";
import { rateLimitHit } from "../../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const creator = await getCurrentCreator();
  if (!creator) return Response.json({ error: "Sign in to create with the assistant. You can still explore the form." }, { status: 401 });
  if (!rateLimitHit(`playlist-agent:${creator.id}`, 8, 60_000)) {
    return Response.json({ error: "Please wait a moment before asking again." }, { status: 429 });
  }
  const raw = await request.text();
  if (raw.length > 24_000) return Response.json({ error: "Conversation is too long. Start a new playlist." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid conversation." }, { status: 400 }); }
  const parsed = playlistConversationSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Send a conversation of up to 16 short messages." }, { status: 400 });
  if (!isAiGatewayConfigured()) {
    return Response.json({ error: "The assistant is unavailable right now. You can create your playlist with the form below." }, { status: 503 });
  }
  try {
    const previousDraft = parsed.data.previousDraft ?? null;
    const result = await createPlaylistDraft(parsed.data.messages, request.signal, previousDraft);
    return Response.json(result);
  } catch {
    // Provider errors can contain request details. Keep them out of the public response.
    return Response.json({ error: "The assistant could not finish this request. Try again or continue with the form." }, { status: 502 });
  }
}
