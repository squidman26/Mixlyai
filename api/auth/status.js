import { upsertAccountFromProviderUser } from "../../lib/accounts.js";
import { buildCreditStatus, ensureAccountCredits, getAccountCredits } from "../../lib/credits.js";
import { ensureValidSession, getProviderName } from "../../lib/music.js";
import { getSession, json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
import { isSquareConfigured } from "../../lib/square.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!session?.refresh_token || !session?.provider) {
    json(res, 200, { authenticated: false });
    return;
  }

  try {
    let valid = await ensureValidSession(session);
    if (!valid) {
      json(res, 200, { authenticated: false });
      return;
    }

    let supabaseError = null;
    let account = null;
    if (valid.user?.id && (!valid.accountId || !valid.supabaseSyncedAt)) {
      try {
        account = await upsertAccountFromProviderUser(valid.user);
        if (account?.id) {
          valid = {
            ...valid,
            accountId: account.id,
            supabaseSyncedAt: Date.now(),
          };
        }
      } catch (err) {
        console.error("Supabase account sync failed:", err.message);
        supabaseError = err.message;
      }
    }

    if (valid.accountId) {
      try {
        if (!account) {
          account = await getAccountCredits(valid.accountId);
        }
        account = await ensureAccountCredits(valid.user, account);
      } catch (err) {
        console.error("Credit sync failed:", err.message);
        if (!supabaseError) supabaseError = err.message;
      }
    }

    save(valid);
    json(res, 200, {
      authenticated: true,
      user: {
        name: valid.user?.display_name || `${getProviderName(valid.provider)} User`,
        id: valid.user?.id,
        provider: valid.provider,
        providerName: getProviderName(valid.provider),
        product: valid.user?.product,
        accountId: valid.accountId ?? null,
        lastLoginAt: valid.supabaseSyncedAt ?? null,
      },
      credits: account ? buildCreditStatus(account, valid.user) : null,
      squareConfigured: isSquareConfigured(),
      supabase: {
        synced: Boolean(valid.accountId && valid.supabaseSyncedAt),
        error: supabaseError,
      },
    });
  } catch {
    json(res, 200, { authenticated: false });
  }
}
