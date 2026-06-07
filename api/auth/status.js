import { upsertAccountFromSpotifyUser } from "../../lib/accounts.js";
import { loadAccountSession } from "../../lib/app-auth.js";
import { buildCreditStatus, ensureAccountCredits, getAccountCredits } from "../../lib/credits.js";
import { ensureValidSession } from "../../lib/spotify.js";
import { getSession, json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
import { isSquareConfigured } from "../../lib/square.js";

function buildStatusPayload({ session, account, supabaseError = null }) {
  const spotifyConnected = Boolean(session?.refresh_token && session?.user?.id);

  return {
    authenticated: true,
    authType: session.authType || (spotifyConnected ? "spotify" : "app"),
    user: {
      name:
        session.displayName ||
        session.user?.display_name ||
        session.username ||
        "User",
      username: session.username ?? null,
      email: session.email ?? session.user?.email ?? null,
      id: session.user?.id ?? null,
      product: session.user?.product ?? null,
      accountId: session.accountId ?? null,
      lastLoginAt: session.supabaseSyncedAt ?? null,
    },
    spotifyConnected,
    credits: account ? buildCreditStatus(account, session.user) : null,
    squareConfigured: isSquareConfigured(),
    supabase: {
      synced: Boolean(session.accountId),
      error: supabaseError,
    },
  };
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);

  if (!session?.accountId && !session?.refresh_token) {
    json(res, 200, { authenticated: false });
    return;
  }

  try {
    let valid = session;

    if (session.refresh_token) {
      const refreshed = await ensureValidSession(session);
      if (!refreshed) {
        if (session.accountId) {
          valid = await loadAccountSession(session);
        } else {
          json(res, 200, { authenticated: false });
          return;
        }
      } else {
        valid = refreshed;
      }
    } else if (session.accountId) {
      const loaded = await loadAccountSession(session);
      if (!loaded) {
        json(res, 200, { authenticated: false });
        return;
      }
      valid = loaded;
    }

    let supabaseError = null;
    let account = null;

    if (valid.user?.id && valid.refresh_token) {
      try {
        account = await upsertAccountFromSpotifyUser(valid.user);
        if (account?.id) {
          valid = {
            ...valid,
            accountId: account.id,
            username: valid.username || account.username,
            email: valid.email || account.email,
            displayName:
              valid.displayName || account.display_name || account.username,
            supabaseSyncedAt: Date.now(),
          };
        }
      } catch (err) {
        console.error("Supabase account sync failed:", err.message);
        supabaseError = err.message;
      }
    }

    if (valid.accountId && !account) {
      try {
        account = await getAccountCredits(valid.accountId);
      } catch (err) {
        console.error("Account load failed:", err.message);
        if (!supabaseError) supabaseError = err.message;
      }
    }

    if (valid.accountId && account) {
      try {
        account = await ensureAccountCredits(valid.user, account);
      } catch (err) {
        console.error("Credit sync failed:", err.message);
        if (!supabaseError) supabaseError = err.message;
      }
    }

    save(valid);
    json(res, 200, buildStatusPayload({ session: valid, account, supabaseError }));
  } catch {
    if (session?.accountId) {
      json(res, 200, buildStatusPayload({ session, account: null }));
      return;
    }
    json(res, 200, { authenticated: false });
  }
}
