import { ensureAccountCredits } from "../../lib/credits.js";
import { attachSpotifyToSession } from "../../lib/app-auth.js";
import { getBaseUrl, getRedirectUri } from "../../lib/config.js";
import { exchangeCode } from "../../lib/spotify.js";
import {
  clearOAuthAccountCookie,
  clearStateCookie,
  readOAuthAccountCookie,
  readOAuthState,
  readSession,
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

  const accountId = readOAuthAccountCookie(req);
  const appSession = readSession(req);

  if (!accountId || appSession?.accountId !== accountId) {
    clearOAuthAccountCookie(res);
    clearStateCookie(res);
    redirect(res, `${getBaseUrl(req)}/?auth_error=sign_in_first`);
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const spotifySession = await exchangeCode(code, redirectUri);
    let session = await attachSpotifyToSession(appSession, spotifySession);

    let supabaseWarning = null;
    try {
      if (session.accountId) {
        const account = await ensureAccountCredits(session.user, {
          id: session.accountId,
        });
        if (account?.id) {
          session = {
            ...session,
            accountId: account.id,
            supabaseSyncedAt: Date.now(),
          };
        }
      }
    } catch (err) {
      console.error("Supabase account sync failed:", err.message);
      supabaseWarning = err.message;
    }

    setSessionCookie(res, session);
    clearStateCookie(res);
    clearOAuthAccountCookie(res);

    const params = new URLSearchParams({ auth: "success" });
    if (supabaseWarning) {
      params.set("supabase_error", supabaseWarning);
    }
    redirect(res, `${getBaseUrl(req)}/?${params}`);
  } catch (err) {
    clearOAuthAccountCookie(res);
    clearStateCookie(res);
    redirect(
      res,
      `${getBaseUrl(req)}/?auth_error=${encodeURIComponent(err.message)}`
    );
  }
}
