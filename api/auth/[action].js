import { getAccountById } from "../../lib/accounts.js";
import { signIn, signUp, isAppAuthenticated } from "../../lib/app-auth.js";
import { buildCreditStatus, ensureAccountCredits, getAccountCredits } from "../../lib/credits.js";
import { getCanonicalBaseUrl } from "../../lib/config.js";
import { getSession, json, readJsonBody, redirect, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
import { upsertSoundCloudConnection } from "../../lib/connections.js";
import {
  clearSoundCloudOAuthCookie,
  exchangeAuthorizationCode,
  getMe,
  getSoundCloudRedirectUri,
  readSoundCloudOAuthCookie,
} from "../../lib/soundcloud.js";
import { isSquareConfigured } from "../../lib/square.js";

async function handleSignup(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const body = await readJsonBody(req);
    const session = await signUp({
      email: body.email,
      username: body.username,
      password: body.password,
    });

    const { save } = getSession(req, res);
    save(session);

    json(res, 200, {
      ok: true,
      user: {
        name: session.displayName,
        username: session.username,
        email: session.email,
        accountId: session.accountId,
      },
    });
  } catch (err) {
    json(res, 400, { error: err.message || "Sign up failed" });
  }
}

async function handleSignin(req, res) {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const body = await readJsonBody(req);
    const session = await signIn({
      login: body.login,
      password: body.password,
    });

    if (!session) {
      json(res, 401, { error: "Invalid email/username or password" });
      return;
    }

    const { save } = getSession(req, res);
    save(session);

    json(res, 200, {
      ok: true,
      user: {
        name: session.displayName || session.username,
        username: session.username,
        email: session.email,
        accountId: session.accountId,
      },
    });
  } catch (err) {
    json(res, 400, { error: err.message || "Sign in failed" });
  }
}

function handleLogout(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  const { clear } = getSession(req, res);
  clear();
  json(res, 200, { ok: true });
}

async function handleStatus(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  const { session } = getSession(req, res);
  if (!isAppAuthenticated(session)) {
    json(res, 200, { authenticated: false });
    return;
  }

  try {
    let account = await getAccountById(session.accountId);
    if (!account) {
      json(res, 200, { authenticated: false });
      return;
    }

    let supabaseError = null;

    try {
      account = await getAccountCredits(session.accountId);
      account = await ensureAccountCredits(null, account);
    } catch (err) {
      console.error("Credit sync failed:", err.message);
      supabaseError = err.message;
    }

    json(res, 200, {
      authenticated: true,
      user: {
        name: session.displayName || account?.display_name || account?.username || "User",
        username: session.username || account?.username,
        email: session.email || account?.email,
        accountId: session.accountId,
      },
      credits: account ? buildCreditStatus(account, null) : null,
      squareConfigured: isSquareConfigured(),
      supabase: {
        synced: Boolean(session.accountId),
        error: supabaseError,
      },
    });
  } catch {
    json(res, 200, { authenticated: false });
  }
}

function handleInfo(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  json(res, 200, {
    canonicalBaseUrl: getCanonicalBaseUrl(),
  });
}

function connectionsRedirect(status, message) {
  const params = new URLSearchParams({
    connections: "soundcloud",
    status,
  });
  if (message) params.set("message", message);
  return `/?${params}`;
}

async function handleSoundCloudCallback(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  const oauthError = req.query?.error;
  if (oauthError) {
    clearSoundCloudOAuthCookie(res);
    redirect(
      res,
      connectionsRedirect("error", String(req.query?.error_description || oauthError))
    );
    return;
  }

  const code = req.query?.code;
  const state = req.query?.state;
  const pending = readSoundCloudOAuthCookie(req);

  if (!code || !state || !pending) {
    clearSoundCloudOAuthCookie(res);
    redirect(res, connectionsRedirect("error", "Missing OAuth state or code"));
    return;
  }

  if (state !== pending.state) {
    clearSoundCloudOAuthCookie(res);
    redirect(res, connectionsRedirect("error", "OAuth state mismatch"));
    return;
  }

  const { session } = getSession(req, res);
  if (!session?.accountId || session.accountId !== pending.accountId) {
    clearSoundCloudOAuthCookie(res);
    redirect(res, connectionsRedirect("error", "Sign in before connecting SoundCloud"));
    return;
  }

  try {
    const redirectUri = getSoundCloudRedirectUri(req);
    const tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      codeVerifier: pending.codeVerifier,
    });
    const profile = await getMe(tokens.access_token);
    await upsertSoundCloudConnection(session.accountId, { profile, tokens });
    clearSoundCloudOAuthCookie(res);
    redirect(res, connectionsRedirect("connected"));
  } catch (err) {
    clearSoundCloudOAuthCookie(res);
    redirect(res, connectionsRedirect("error", err.message || "SoundCloud connection failed"));
  }
}

export default async function handler(req, res) {
  const action = req.query?.action;

  if (action === "info") {
    handleInfo(req, res);
    return;
  }

  if (action === "soundcloud-callback") {
    await handleSoundCloudCallback(req, res);
    return;
  }

  if (!requireAccess(req, res)) return;

  switch (action) {
    case "signup":
      await handleSignup(req, res);
      break;
    case "signin":
      await handleSignin(req, res);
      break;
    case "logout":
      handleLogout(req, res);
      break;
    case "status":
      await handleStatus(req, res);
      break;
    default:
      json(res, 404, { error: "Unknown auth action" });
  }
}
