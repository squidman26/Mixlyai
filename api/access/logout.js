import { clearAccessCookie } from "../../lib/gate.js";
import { json, requireMethod } from "../../lib/api.js";

export default function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  clearAccessCookie(res);
  json(res, 200, { ok: true });
}
