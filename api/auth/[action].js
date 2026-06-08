import { getAccountById } from "../../lib/accounts.js";
import { signIn, signUp, isAppAuthenticated } from "../../lib/app-auth.js";
import { buildCreditStatus, ensureAccountCredits, getAccountCredits } from "../../lib/credits.js";
import { getCanonicalBaseUrl } from "../../lib/config.js";
import { upsertYoutubeConnection } from "../../lib/connections.js";
import {
  clearYoutubeOAuthPending,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserProfile,
  getSupabasePublicConfig,
  getYoutubeRedirectUri,
  readYoutubeOAuthPending,
} from "../../lib/google-auth.js";
import { getSession, json, readJsonBody, redirect, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
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
    ...getSupabasePublicConfig(),
  });
}

function connectionsRedirect(status, message) {
  const params = new URLSearchParams({
    connections: "youtube",
    status,
  });
  if (message) params.set("message", message);
  return `/?${params}`;
}

async function handleYoutubeCallback(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  const oauthError = req.query?.error;
  if (oauthError) {
    clearYoutubeOAuthPending(res);
    redirect(
      res,
      connectionsRedirect("error", String(req.query?.error_description || oauthError))
    );
    return;
  }

  const code = req.query?.code;
  const state = req.query?.state;
  const pending = readYoutubeOAuthPending(req);

  if (!code || !state || !pending) {
    clearYoutubeOAuthPending(res);
    redirect(res, connectionsRedirect("error", "Missing OAuth state or code"));
    return;
  }

  if (state !== pending.state) {
    clearYoutubeOAuthPending(res);
    redirect(res, connectionsRedirect("error", "OAuth state mismatch"));
    return;
  }

  const { session } = getSession(req, res);
  if (!session?.accountId || session.accountId !== pending.accountId) {
    clearYoutubeOAuthPending(res);
    redirect(res, connectionsRedirect("error", "Sign in before connecting YouTube"));
    return;
  }

  try {
    const redirectUri = getYoutubeRedirectUri(req);
    const tokens = await exchangeGoogleAuthorizationCode({
      code,
      redirectUri,
      codeVerifier: pending.codeVerifier,
    });
    const profile = await fetchGoogleUserProfile(tokens.access_token);
    await upsertYoutubeConnection(session.accountId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresIn: tokens.expires_in ?? 3600,
      externalId: profile.id ?? null,
      displayName: profile.name || profile.email || null,
      scope: tokens.scope ?? null,
    });
    clearYoutubeOAuthPending(res);
    redirect(res, connectionsRedirect("connected"));
  } catch (err) {
    clearYoutubeOAuthPending(res);
    redirect(res, connectionsRedirect("error", err.message || "YouTube connection failed"));
  }
}

export default async function handler(req, res) {
  const action = req.query?.action;

  if (action === "info") {
    handleInfo(req, res);
    return;
  }

  if (action === "youtube-callback") {
    await handleYoutubeCallback(req, res);
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
