import { json } from "./api.js";

export function requireAccess(_req, _res) {
  return true;
}

export function isGateEnabled() {
  return false;
}

export function hasAccess(_req) {
  return true;
}

export function verifyAccessCode(_code) {
  return true;
}

export function getAccessCodeFromRequest(_req) {
  return "";
}

export function denyAccess(res) {
  json(res, 403, { error: "access denied" });
}
