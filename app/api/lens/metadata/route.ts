import { textOnly } from "@lens-protocol/metadata";
import { withCreator, jsonError } from "../../../../lib/auth";
import { lensPostBodyTooLarge, validateLensPostContent } from "../../../../lib/lens-post-content";
import { rateLimitHit } from "../../../../lib/rate-limit";
import { isPinataConfigured, uploadFile } from "../../../../lib/pinata";

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
    if (!isPinataConfigured()) {
      return jsonError("Post uploads are not configured. Set PINATA_JWT on the server.", 503);
    }
    const metadata = textOnly({ content: validated.content });
    const uploaded = await uploadFile(Buffer.from(JSON.stringify(metadata)), { name: `lens-post-${crypto.randomUUID()}.json`, mimeType: "application/json" });
    // Public IPFS URI: never include the authenticated gateway token in public metadata.
    return Response.json({ contentUri: `ipfs://${uploaded.cid}` });
  });
}
