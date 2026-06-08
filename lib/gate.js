import crypto from "crypto";
import { json } from "./api.js";
import { parseCookies } from "./session.js";

const ACCESS_COOKIE = "mixly_access";

export function getAccessCode() {
  return process.env.SITE_ACCESS_CODE?.trim() || "";
}

export function isGateEnabled() {
  return Boolean(getAccessCode());
}

function accessToken() {
  return crypto.createHash("sha256").update(getAccessCode()).digest("hex");
}

export function verifyAccessCode(code) {
  if (!isGateEnabled()) return true;
  return code?.trim() === getAccessCode();
}

export function hasAccess(req) {
  if (!isGateEnabled()) return true;
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[ACCESS_COOKIE] === accessToken();
}

function isWebhookRequest(req) {
  const url = req.url || "";
  return url.includes("/api/webhooks/");
}

export function requireAccess(req, res) {
  if (!isGateEnabled()) return true;
  if (isWebhookRequest(req)) return true;
  if (hasAccess(req)) return true;
  json(res, 403, { error: "access denied" });
  return false;
}

function cookieFlags(maxAge) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const parts = ["Path=/", "HttpOnly", secure ? "SameSite=None" : "SameSite=Lax"];
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

export function setAccessCookie(res) {
  appendCookie(res, `${ACCESS_COOKIE}=${accessToken()}; ${cookieFlags(60 * 60 * 24 * 30)}`);
}

export function clearAccessCookie(res) {
  appendCookie(res, `${ACCESS_COOKIE}=; ${cookieFlags(0)}`);
}
