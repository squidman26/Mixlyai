import {
  readSession,
  setSessionCookie,
  clearSessionCookie,
} from "./session.js";

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

export function getSession(req, res) {
  const session = readSession(req);
  return {
    session,
    save(session) {
      if (session) setSessionCookie(res, session);
    },
    clear() {
      clearSessionCookie(res);
    },
  };
}

export function requireMethod(req, res, method) {
  if (req.method !== method) {
    json(res, 405, { error: "Method not allowed" });
    return false;
  }
  return true;
}

export function requireSpotifySession(req, res, session) {
  if (session?.refresh_token) return true;
  json(res, 401, { error: "Connect Spotify first" });
  return false;
}
