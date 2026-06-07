import { getAccountById } from "../../lib/accounts.js";
import { buildCreditStatus, ensureAccountCredits, getAccountCredits } from "../../lib/credits.js";
import { isAppAuthenticated } from "../../lib/app-auth.js";
import { getSession, json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
import { isSquareConfigured } from "../../lib/square.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

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
