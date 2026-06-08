import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import {
  hasAccess,
  setAccessCookie,
  verifyAccessCode,
} from "../lib/gate.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function getRequestUrl(req) {
  const host = req.headers["x-forwarded-host"]?.split(",")[0]?.trim() || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim() || "https";
  return new URL(req.url || "/", `${proto}://${host}`);
}

function safePublicPath(pathParam) {
  const raw = (pathParam || "").replace(/^\/+/, "") || "index.html";
  if (!raw || raw.includes("..")) return null;
  return raw;
}

function deny(res) {
  res.statusCode = 403;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end("access denied");
}

export default function handler(req, res) {
  const url = getRequestUrl(req);
  const accessCode = url.searchParams.get("access");

  if (accessCode && verifyAccessCode(accessCode)) {
    setAccessCookie(res);
    url.searchParams.delete("access");
    const query = url.searchParams.toString();
    res.writeHead(302, { Location: query ? `/?${query}` : "/" });
    res.end();
    return;
  }

  if (!hasAccess(req)) {
    deny(res);
    return;
  }

  const filePath = safePublicPath(url.searchParams.get("path"));
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
