import { getCanonicalBaseUrl } from "../../lib/config.js";
import { json, requireMethod } from "../../lib/api.js";

export default function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  json(res, 200, {
    canonicalBaseUrl: getCanonicalBaseUrl(),
  });
}
