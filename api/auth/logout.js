import { getSession, json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";

export default function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;
  const { clear } = getSession(req, res);
  clear();
  json(res, 200, { ok: true });
}
