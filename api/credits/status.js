import {
  buildCreditStatus,
  ensureAccountCredits,
  getAccountCredits,
  listCreditTransactions,
} from "../../lib/credits.js";
import { checkSupabaseCreditSchema } from "../../lib/supabase.js";
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
    const schema = await checkSupabaseCreditSchema();
    if (!schema.ok) {
      json(res, 503, { error: schema.error });
      return;
    }

    let account = await getAccountCredits(session.accountId);
    if (!account) {
      json(res, 404, { error: "Account not found" });
      return;
    }

    account = await ensureAccountCredits(session.user, account);
    const transactions = await listCreditTransactions(session.accountId);

    json(res, 200, {
      ...buildCreditStatus(account, session.user),
      squareConfigured: isSquareConfigured(),
      supabaseSynced: true,
      transactions,
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to load credits" });
  }
}
