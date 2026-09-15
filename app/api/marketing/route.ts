import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Serves the marketing landing HTML for Vercel.
 * Pinata/PM2 still serves the same file from server.js at `/`.
 * Root `/` is rewritten here via next.config (basePath: false).
 */
const landingHtml = readFileSync(join(process.cwd(), "landing", "index.html"), "utf8");

export function GET() {
  return new Response(landingHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
}
