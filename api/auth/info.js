import { getCanonicalBaseUrl, getRedirectUri } from "../../lib/config.js";
import { json, requireMethod } from "../../lib/api.js";

export default function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  let redirectUri;
  let canonicalBaseUrl;
  try {
    redirectUri = getRedirectUri(req);
    canonicalBaseUrl = getCanonicalBaseUrl();
  } catch {
    redirectUri = null;
    canonicalBaseUrl = null;
  }

  json(res, 200, { redirectUri, canonicalBaseUrl });
}
