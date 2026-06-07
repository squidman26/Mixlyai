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

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody(req) {
  const raw = await readRawBody(req);
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

export function requireAppSession(req, res, session) {
  if (session?.accountId) return true;
  json(res, 401, { error: "Sign in first" });
  return false;
}

export async function requireConnectedService(req, res, session) {
  if (!requireAppSession(req, res, session)) return false;

  const { accountHasConnectedService } = await import("./connections.js");
  try {
    const connected = await accountHasConnectedService(session.accountId);
    if (!connected) {
      json(res, 403, { error: "Connect a music service first" });
      return false;
    }
    return true;
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to verify connection" });
    return false;
  }
}

export function respondInsufficientCredits(res, result) {
  json(res, 402, {
    error: "Insufficient credits",
    credits: result.credits,
    required: result.required,
    tier: result.tier,
  });
}
