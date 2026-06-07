import {
  SCOPES,
  getCanonicalBaseUrl,
  isPreviewDeployment,
  loadSpotifyConfig,
} from "../../lib/config.js";
import { createOAuthState, setStateCookie } from "../../lib/session.js";
import { redirect } from "../../lib/api.js";

const AUTH_URL = "https://accounts.spotify.com/authorize";

export default function handler(req, res) {
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

  const { state, nonce } = createOAuthState();
  setStateCookie(res, nonce);

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: SCOPES,
    state,
    show_dialog: "true",
  });

  redirect(res, `${AUTH_URL}?${params}`);
}
