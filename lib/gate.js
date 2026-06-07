import { json } from "./api.js";

export function isGateEnabled() {
  return false;
}

export function hasAccess() {
  return true;
}

export function requireAccess() {
  return true;
}

export function clearAccessCookie() {}

export function setAccessCookie() {}

export function verifyAccessCode() {
  return true;
}

export function getAccessCode() {
  return "";
}
