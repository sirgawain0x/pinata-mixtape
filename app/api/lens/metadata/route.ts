import { textOnly } from "@lens-protocol/metadata";
import { withCreator, jsonError } from "../../../../lib/auth";
import { rateLimitHit } from "../../../../lib/rate-limit";
import { uploadFile } from "../../../../lib/pinata";

export async function POST(request: Request) {
  return withCreator(async (creator) => {
    if (!rateLimitHit(`lens-metadata:${creator.id}`, 6, 60_000)) return jsonError("Please wait before preparing another post.", 429);
    if (Number(request.headers.get("content-length") || 0) > 12000) return jsonError("Post is too long.", 413);
    const body = await request.text();
    if (body.length > 12000) return jsonError("Post is too long.", 413);
    let input;
    try { input = JSON.parse(body); } catch { return jsonError("Invalid post.", 400); }
    if (typeof input.content !== "string" || !input.content.trim() || input.content.length > 4000) return jsonError("Write a post of up to 4,000 characters.", 400);
    const metadata = textOnly({ content: input.content.trim() });
    const uploaded = await uploadFile(Buffer.from(JSON.stringify(metadata)), { name: `lens-post-${crypto.randomUUID()}.json`, mimeType: "application/json" });
    // Public IPFS URI: never include the authenticated gateway token in public metadata.
    return Response.json({ contentUri: `ipfs://${uploaded.cid}` });
  });
}
