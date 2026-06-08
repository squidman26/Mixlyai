import { json } from "./api.js";
import { readSession } from "./session.js";

export function getAccessCode() {
  return process.env.SITE_ACCESS_CODE?.trim() || "";
}

export function isGateEnabled() {
  return Boolean(getAccessCode());
}

export function verifyAccessCode(code) {
  if (!isGateEnabled()) return true;
  return code?.trim() === getAccessCode();
}

export function getAccessCodeFromRequest(req) {
  return req.headers?.["x-site-access-code"]?.trim() || "";
}

export function hasAccess(req) {
  if (!isGateEnabled()) return true;
  return verifyAccessCode(getAccessCodeFromRequest(req));
}

function isWebhookRequest(req) {
  const url = req.url || "";
  return url.includes("/api/webhooks/");
}

function hasAppSession(req) {
  return Boolean(readSession(req)?.accountId);
}

function isGateProbeRequest(req) {
  const url = req.url || "";
  if (url.includes("/api/access")) return true;
  if (req.method === "GET" && url.includes("/api/auth/status")) return true;
  return false;
}

export function requireAccess(req, res) {
  if (!isGateEnabled()) return true;
  if (isWebhookRequest(req)) return true;
  if (isGateProbeRequest(req)) return true;
  if (hasAppSession(req)) return true;
  if (hasAccess(req)) return true;
  json(res, 403, { error: "access denied" });
  return false;
}
