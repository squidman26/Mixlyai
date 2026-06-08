import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function safePublicPath(pathParam) {
  const raw = (pathParam || "").replace(/^\/+/, "") || "index.html";
  if (!raw || raw.includes("..")) return null;
  return raw;
}

function deny(res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end("Not found");
}

export default function handler(req, res) {
  const filePath = safePublicPath(new URL(req.url || "/", "http://localhost").searchParams.get("path"));
  if (!filePath) {
    deny(res);
    return;
  }

  const absolute = join(process.cwd(), "web", filePath);
  if (!existsSync(absolute)) {
    deny(res);
    return;
  }

  const ext = extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.setHeader(
    "Cache-Control",
    filePath === "index.html" ? "no-store" : "public, max-age=3600"
  );
  res.end(readFileSync(absolute));
}
