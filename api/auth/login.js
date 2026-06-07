import {
  getCanonicalBaseUrl,
  isPreviewDeployment,
  loadProviderConfig,
  getProviderAuthConfig,
} from "../../lib/config.js";
import { isValidProvider } from "../../lib/music.js";
import {
  createOAuthState,
  setStateCookie,
  setProviderCookie,
} from "../../lib/session.js";
import { redirect, json } from "../../lib/api.js";

export default function handler(req, res) {
  if (isPreviewDeployment(req)) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const provider = url.searchParams.get("provider") || "youtube";
    redirect(
      res,
      `${getCanonicalBaseUrl()}/api/auth/login?provider=${provider}`
    );
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const provider = url.searchParams.get("provider") || "youtube";

  if (!isValidProvider(provider)) {
    json(res, 400, { error: "Invalid provider. Use youtube or soundcloud." });
    return;
  }

  let config;
  try {
    config = loadProviderConfig(provider, req);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end(
      `Server not configured for ${provider}. Add ${provider.toUpperCase()}_CLIENT_ID, ${provider.toUpperCase()}_CLIENT_SECRET, OAUTH_REDIRECT_URI, and SESSION_SECRET in environment variables, then redeploy.`
    );
    return;
  }

  const { state, nonce } = createOAuthState();
  setStateCookie(res, nonce);
  setProviderCookie(res, provider);

  const authEntry = getProviderAuthConfig(provider);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: authEntry.scopes,
    state,
  });

  if (provider === "youtube") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  redirect(res, `${authEntry.authUrl}?${params}`);
}
