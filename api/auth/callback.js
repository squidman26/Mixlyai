import { getBaseUrl } from "../../lib/config.js";
import { exchangeCode } from "../../lib/spotify.js";
import {
  readOAuthState,
  setSessionCookie,
  clearStateCookie,
} from "../../lib/session.js";
import { redirect } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";

export default async function handler(req, res) {
  if (!requireAccess(req, res)) return;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = readOAuthState(req);

  if (error) {
    redirect(res, `${getBaseUrl()}/?auth_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state || state !== savedState) {
    redirect(res, `${getBaseUrl()}/?auth_error=invalid_state`);
    return;
  }

  try {
    const session = await exchangeCode(code);
    setSessionCookie(res, session);
    clearStateCookie(res);
    redirect(res, `${getBaseUrl()}/?auth=success`);
  } catch (err) {
    redirect(
      res,
      `${getBaseUrl()}/?auth_error=${encodeURIComponent(err.message)}`
    );
  }
}
