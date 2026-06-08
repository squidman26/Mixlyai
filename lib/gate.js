import { json } from "./api.js";
import { hasAccessCookie } from "./session.js";

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
  const accessCode = getAccessCode();
  if (verifyAccessCode(getAccessCodeFromRequest(req))) return true;
  return hasAccessCookie(req, accessCode);
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
