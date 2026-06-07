import crypto from "crypto";
import { requireEnv } from "./config.js";

const COOKIE = "mx_session";
const STATE_COOKIE = "mx_oauth_state";
const PROVIDER_COOKIE = "mx_oauth_provider";
const PKCE_COOKIE = "mx_oauth_pkce";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function getKey() {
  return crypto
    .createHash("sha256")
    .update(requireEnv("SESSION_SECRET"))
    .digest();
}

export function seal(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function unseal(token) {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([
      decipher.update(enc),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

function cookieFlags(maxAge) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

function appendCookie(res, cookie) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookie);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookie]);
  else res.setHeader("Set-Cookie", [prev, cookie]);
}

export function setSessionCookie(res, session) {
  const value = seal(session);
  appendCookie(res, `${COOKIE}=${value}; ${cookieFlags(60 * 60 * 24 * 30)}`);
}

export function clearSessionCookie(res) {
  appendCookie(res, `${COOKIE}=; ${cookieFlags(0)}`);
}

export function setStateCookie(res, state) {
  appendCookie(res, `${STATE_COOKIE}=${state}; ${cookieFlags(600)}`);
}

export function clearStateCookie(res) {
  appendCookie(res, `${STATE_COOKIE}=; ${cookieFlags(0)}`);
  appendCookie(res, `${PROVIDER_COOKIE}=; ${cookieFlags(0)}`);
  appendCookie(res, `${PKCE_COOKIE}=; ${cookieFlags(0)}`);
}

export function setPkceCookie(res, verifier) {
  appendCookie(res, `${PKCE_COOKIE}=${verifier}; ${cookieFlags(600)}`);
}

export function readPkceCookie(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[PKCE_COOKIE] || null;
}

export function setProviderCookie(res, provider) {
  appendCookie(res, `${PROVIDER_COOKIE}=${provider}; ${cookieFlags(600)}`);
}

export function readProviderCookie(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[PROVIDER_COOKIE] || null;
}

export function readSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  return unseal(cookies[COOKIE]);
}

export function readOAuthState(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[STATE_COOKIE] || null;
}

function signOAuthPayload(nonce, ts, provider) {
  return crypto
    .createHmac("sha256", getKey())
    .update(`${nonce}.${ts}.${provider}`)
    .digest("base64url");
}

function signOAuthPayloadLegacy(nonce, ts) {
  return crypto
    .createHmac("sha256", getKey())
    .update(`${nonce}.${ts}`)
    .digest("base64url");
}

function verifySignature(sig, expected) {
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function isFreshTimestamp(ts) {
  return (
    Date.now() - ts <= OAUTH_STATE_TTL_MS && ts <= Date.now() + 60_000
  );
}

export function createOAuthState(provider = "youtube") {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now();
  const sig = signOAuthPayload(nonce, ts, provider);
  return {
    state: `${nonce}.${ts}.${provider}.${sig}`,
    nonce,
    provider,
  };
}

export function parseOAuthState(state) {
  if (!state) return null;

  const parts = state.split(".");

  if (parts.length === 4) {
    const [nonce, tsStr, provider, sig] = parts;
    const ts = Number(tsStr);
    if (!nonce || !Number.isFinite(ts) || !provider || !sig) return null;
    if (!isFreshTimestamp(ts)) return null;

    const expected = signOAuthPayload(nonce, ts, provider);
    if (!verifySignature(sig, expected)) return null;

    return { nonce, ts, provider, valid: true };
  }

  if (parts.length === 3) {
    const [nonce, tsStr, sig] = parts;
    const ts = Number(tsStr);
    if (!nonce || !Number.isFinite(ts) || !sig) return null;
    if (!isFreshTimestamp(ts)) return null;

    const expected = signOAuthPayloadLegacy(nonce, ts);
    if (!verifySignature(sig, expected)) return null;

    return { nonce, ts, provider: null, valid: true };
  }

  return null;
}

export function verifyOAuthState(state) {
  return parseOAuthState(state) !== null;
}

export { COOKIE, STATE_COOKIE, PROVIDER_COOKIE, PKCE_COOKIE };
