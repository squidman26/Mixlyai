import crypto from "crypto";
import { requireEnv, trimEnv } from "./config.js";
import { parseCookies } from "./session.js";
import { json } from "./api.js";

const ACCESS_COOKIE = "pb_access";

function getKey() {
  return crypto
    .createHash("sha256")
    .update(requireEnv("SESSION_SECRET"))
    .digest();
}

function seal(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function unseal(token) {
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

export function getAccessCode() {
  return requireEnv("SITE_ACCESS_CODE");
}

export function isGateEnabled() {
  return Boolean(trimEnv("SITE_ACCESS_CODE"));
}

export function hasAccess(req) {
  if (!isGateEnabled()) return true;
  const cookies = parseCookies(req.headers.cookie);
  const payload = unseal(cookies[ACCESS_COOKIE]);
  return payload?.access === true;
}

export function setAccessCookie(res) {
  const value = seal({ access: true, at: Date.now() });
  // Session cookie — cleared when the browser closes; not reused across visits
  appendCookie(res, `${ACCESS_COOKIE}=${value}; ${cookieFlags()}`);
}

export function clearAccessCookie(res) {
  appendCookie(res, `${ACCESS_COOKIE}=; ${cookieFlags(0)}`);
}

export function verifyAccessCode(code) {
  if (!isGateEnabled()) return true;
  const expected = getAccessCode();
  return typeof code === "string" && code.trim() === expected;
}

export function requireAccess(req, res) {
  if (hasAccess(req)) return true;
  json(res, 403, { error: "Access code required" });
  return false;
}
