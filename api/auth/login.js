import {
  SCOPES,
  getCanonicalBaseUrl,
  isPreviewDeployment,
  loadSpotifyConfig,
} from "../../lib/config.js";
import { createOAuthState } from "../../lib/session.js";
import { redirect } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";

const AUTH_URL = "https://accounts.spotify.com/authorize";

export default function handler(req, res) {
  if (!requireAccess(req, res)) return;

  if (isPreviewDeployment(req)) {
    redirect(res, `${getCanonicalBaseUrl()}/api/auth/login`);
    return;
  }

  let config;
  try {
    config = loadSpotifyConfig(req);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end(
      "Server not configured. Add SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI, and SESSION_SECRET in Vercel environment variables, then redeploy."
    );
    return;
  }

  const state = createOAuthState();

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: SCOPES,
    state,
  });

  redirect(res, `${AUTH_URL}?${params}`);
}
