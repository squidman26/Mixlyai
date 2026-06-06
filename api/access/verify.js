import {
  verifyAccessCode,
  setAccessCookie,
  isGateEnabled,
} from "../../lib/gate.js";
import { json, readJsonBody, requireMethod } from "../../lib/api.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  if (!isGateEnabled()) {
    json(res, 200, { ok: true, enabled: false });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!verifyAccessCode(body.code)) {
      json(res, 401, { error: "Invalid access code" });
      return;
    }
    setAccessCookie(res);
    json(res, 200, { ok: true });
  } catch {
    json(res, 400, { error: "Invalid request" });
  }
}
