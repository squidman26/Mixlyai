import { hasAccess, isGateEnabled } from "../../lib/gate.js";
import { json, requireMethod } from "../../lib/api.js";

export default function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  json(res, 200, {
    enabled: isGateEnabled(),
    unlocked: hasAccess(req),
  });
}
