import { upsertAccountFromSpotifyUser } from "../../lib/accounts.js";
import { getBaseUrl, getRedirectUri } from "../../lib/config.js";
import { exchangeCode } from "../../lib/spotify.js";
import { setSessionCookie, verifyOAuthState } from "../../lib/session.js";
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

  if (!code || !state || !verifyOAuthState(state)) {
    redirect(res, `${getBaseUrl(req)}/?auth_error=invalid_state`);
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const session = await exchangeCode(code, redirectUri);

    try {
      const account = await upsertAccountFromSpotifyUser(session.user);
      if (account?.id) {
        session.accountId = account.id;
      }
    } catch (err) {
      console.error("Supabase account sync failed:", err.message);
    }

    setSessionCookie(res, session);
    redirect(res, `${getBaseUrl(req)}/?auth=success`);
  } catch (err) {
    redirect(
      res,
      `${getBaseUrl(req)}/?auth_error=${encodeURIComponent(err.message)}`
    );
  }
}
