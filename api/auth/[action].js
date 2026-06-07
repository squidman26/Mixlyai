import { getAccountById } from "../../lib/accounts.js";
import { accountHasConnectedService } from "../../lib/connections.js";
import { signIn, signUp, isAppAuthenticated } from "../../lib/app-auth.js";
import { buildCreditStatus, ensureAccountCredits, getAccountCredits } from "../../lib/credits.js";
import { getCanonicalBaseUrl } from "../../lib/config.js";
import { getSession, json, readJsonBody, requireMethod } from "../../lib/api.js";
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

    let hasConnectedService = false;
    try {
      hasConnectedService = await accountHasConnectedService(session.accountId);
    } catch (err) {
      console.error("Connection check failed:", err.message);
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
      hasConnectedService,
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

export default async function handler(req, res) {
  const action = req.query?.action;

  if (action === "info") {
    handleInfo(req, res);
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
