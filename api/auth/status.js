import { upsertAccountFromSpotifyUser } from "../../lib/accounts.js";
import { ensureValidSession } from "../../lib/spotify.js";
import { getSession, json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!session?.refresh_token) {
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
    if (valid.user?.id && (!valid.accountId || !valid.supabaseSyncedAt)) {
      try {
        const account = await upsertAccountFromSpotifyUser(valid.user);
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

    save(valid);
    json(res, 200, {
      authenticated: true,
      user: {
        name: valid.user?.display_name || "Spotify User",
        id: valid.user?.id,
        product: valid.user?.product,
        accountId: valid.accountId ?? null,
        lastLoginAt: valid.supabaseSyncedAt ?? null,
      },
      supabase: {
        synced: Boolean(valid.accountId && valid.supabaseSyncedAt),
        error: supabaseError,
      },
    });
  } catch {
    json(res, 200, { authenticated: false });
  }
}
