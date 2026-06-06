import { getRedirectUri } from "../../lib/config.js";
import { json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";

export default function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  let redirectUri;
  try {
    redirectUri = getRedirectUri(req);
  } catch {
    redirectUri = null;
  }

  json(res, 200, { redirectUri });
}
