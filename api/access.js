import {
  clearAccessCookie,
  hasAccess,
  isGateEnabled,
  setAccessCookie,
  verifyAccessCode,
} from "../lib/gate.js";
import { json, readJsonBody, requireMethod } from "../lib/api.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!requireMethod(req, res, "GET")) return;
    json(res, 200, {
      enabled: isGateEnabled(),
      unlocked: hasAccess(req),
    });
    return;
  }

  if (req.method === "POST") {
    if (!requireMethod(req, res, "POST")) return;

    let body = {};
    try {
      body = await readJsonBody(req);
    } catch {
      body = {};
    }

    if (body.action === "logout") {
      clearAccessCookie(res);
      json(res, 200, { ok: true });
      return;
    }

    if (!isGateEnabled()) {
      json(res, 200, { ok: true, enabled: false });
      return;
    }

    if (!verifyAccessCode(body.code)) {
      json(res, 401, { error: "Invalid access code" });
      return;
    }

    setAccessCookie(res);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 405, { error: "Method not allowed" });
}
