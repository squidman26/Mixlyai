import { upsertAccountFromProviderUser } from "../../lib/accounts.js";
import { ensureAccountCredits } from "../../lib/credits.js";
import { getBaseUrl, getRedirectUri } from "../../lib/config.js";
import { exchangeCode } from "../../lib/music.js";
import { isValidProvider } from "../../lib/music.js";
import {
  clearStateCookie,
  readOAuthState,
  readProviderCookie,
  setSessionCookie,
  verifyOAuthState,
} from "../../lib/session.js";
import { redirect } from "../../lib/api.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const provider = readProviderCookie(req);

  if (error) {
    redirect(
      res,
      `${getBaseUrl(req)}/?auth_error=${encodeURIComponent(error)}`
    );
    return;
  }

  const cookieNonce = readOAuthState(req);
  const stateValid = verifyOAuthState(state, cookieNonce);

  if (!code || !state || !stateValid || !isValidProvider(provider)) {
    console.error("OAuth state rejected", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasCookie: Boolean(cookieNonce),
      provider,
      host: req.headers.host,
    });
    redirect(res, `${getBaseUrl(req)}/?auth_error=invalid_state`);
    return;
  }

  try {
    const redirectUri = getRedirectUri(req);
    const session = await exchangeCode(provider, code, redirectUri);

    let supabaseWarning = null;
    try {
      let account = await upsertAccountFromProviderUser(session.user);
      if (account?.id) {
        account = await ensureAccountCredits(session.user, account);
        session.accountId = account.id;
        session.supabaseSyncedAt = Date.now();
      }
    } catch (err) {
      console.error("Supabase account sync failed:", err.message);
      supabaseWarning = err.message;
    }

    setSessionCookie(res, session);
    clearStateCookie(res);

    const params = new URLSearchParams({ auth: "success", provider });
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
