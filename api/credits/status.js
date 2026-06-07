import {
  buildCreditStatus,
  ensureAccountCredits,
  getAccountCredits,
} from "../../lib/credits.js";
import { getSession, json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
import { isSquareConfigured } from "../../lib/square.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session } = getSession(req, res);
  if (!session?.refresh_token || !session?.accountId) {
    json(res, 401, { error: "Connect Spotify first" });
    return;
  }

  try {
    let account = await getAccountCredits(session.accountId);
    if (!account) {
      json(res, 404, { error: "Account not found" });
      return;
    }

    account = await ensureAccountCredits(session.user, account);
    json(res, 200, {
      ...buildCreditStatus(account, session.user),
      squareConfigured: isSquareConfigured(),
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to load credits" });
  }
}
