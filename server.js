import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

const landingHtml = readFileSync(join(__dirname, "landing", "index.html"), "utf8");

function pathnameOf(url = "/") {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

app.prepare().then(() => {
  createServer((req, res) => {
    const pathname = pathnameOf(req.url);

    if (pathname === "/health" || pathname === "/app/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, app: "creative-mixtape", route: "/app" }));
      return;
    }

    // Marketing site at domain root; mixtape product stays under /app (Next basePath).
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60"
      });
      res.end(landingHtml);
      return;
    }

    handle(req, res);
  }).listen(port, host, () => {
    console.log(`creative-mixtape listening on ${host}:${port}`);
    console.log(`landing: http://${host}:${port}/`);
    console.log(`app:     http://${host}:${port}/app`);
  });
});
