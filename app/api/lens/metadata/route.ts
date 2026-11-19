import { textOnly } from "@lens-protocol/metadata";
import { withCreator, jsonError } from "../../../../lib/auth";
import { lensPostBodyTooLarge, validateLensPostContent } from "../../../../lib/lens-post-content";
import { rateLimitHit } from "../../../../lib/rate-limit";
import { isGroveConfigured, uploadGroveJson } from "../../../../lib/grove";

export async function POST(request: Request) {
  return withCreator(async (creator) => {
    if (!rateLimitHit(`lens-metadata:${creator.id}`, 6, 60_000)) return jsonError("Please wait before preparing another post.", 429);
    const contentLength = Number(request.headers.get("content-length") || 0) || null;
    const body = await request.text();
    if (lensPostBodyTooLarge(contentLength, body.length)) return jsonError("Post is too long.", 413);
    let input;
    try { input = JSON.parse(body); } catch { return jsonError("Invalid post.", 400); }
    const validated = validateLensPostContent(input?.content);
    if (!validated.ok) return jsonError(validated.message, validated.status);
    if (!isGroveConfigured()) {
      return jsonError("Lens Grove storage is disabled on the server.", 503);
    }
    const metadata = textOnly({ content: validated.content });
    const uploaded = await uploadGroveJson(metadata, {
      name: `lens-post-${crypto.randomUUID()}.json`,
      walletAddress: creator.walletAddress,
    });
    return Response.json({ contentUri: uploaded.uri, gatewayUrl: uploaded.url });
  });
}
