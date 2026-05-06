import { createServer } from "node:http";
import next from "next";

const basePath = "/app";
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

function normalizeBasePath(url) {
  if (!url || url === "*") return url;
  const alreadyPrefixed = url === basePath || url.startsWith(`${basePath}/`) || url.startsWith(`${basePath}?`);
  if (alreadyPrefixed) return url;
  return `${basePath}${url.startsWith("/") ? url : `/${url}`}`;
}

app.prepare().then(() => {
  createServer((req, res) => {
    if (req.url === "/health" || req.url === "/app/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, app: "pinata-mixtape", route: "/app" }));
      return;
    }

    // Pinata path routes can strip "/app" before proxying to the container.
    // Next is configured with basePath="/app", so normalize stripped requests
    // before they reach the Next request handler.
    req.url = normalizeBasePath(req.url);
    handle(req, res);
  }).listen(port, host, () => {
    console.log(`pinata-mixtape listening on ${host}:${port}`);
  });
});
