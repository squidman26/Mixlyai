import { upsertAccountFromSpotifyUser } from "../../lib/accounts.js";
import { getBaseUrl, getRedirectUri } from "../../lib/config.js";
import { exchangeCode } from "../../lib/spotify.js";
import {
  clearStateCookie,
  readOAuthState,
  setSessionCookie,
  verifyOAuthState,
} from "../../lib/session.js";
import { redirect } from "../../lib/api.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    redirect(
      res,
      `${getBaseUrl(req)}/?auth_error=${encodeURIComponent(error)}`
    );
    return;
  }

  const cookieNonce = readOAuthState(req);
  const stateValid = verifyOAuthState(state, cookieNonce);

  if (!code || !state || !stateValid) {
    console.error("OAuth state rejected", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasCookie: Boolean(cookieNonce),
      host: req.headers.host,
    });
    redirect(res, `${getBaseUrl(req)}/?auth_error=invalid_state`);
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const session = await exchangeCode(code, redirectUri);

    let supabaseWarning = null;
    try {
      const account = await upsertAccountFromSpotifyUser(session.user);
      if (account?.id) {
        session.accountId = account.id;
        session.supabaseSyncedAt = Date.now();
      }
    } catch (err) {
      console.error("Supabase account sync failed:", err.message);
      supabaseWarning = err.message;
    }

    setSessionCookie(res, session);
    clearStateCookie(res);

    const params = new URLSearchParams({ auth: "success" });
    if (supabaseWarning) {
      params.set("supabase_error", supabaseWarning);
    }
    redirect(res, `${getBaseUrl(req)}/?${params}`);
  } catch (err) {
    redirect(
      res,
      `${getBaseUrl(req)}/?auth_error=${encodeURIComponent(err.message)}`
    );
  }
}
