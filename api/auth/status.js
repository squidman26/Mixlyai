import { getAccountById } from "../../lib/accounts.js";
import { buildCreditStatus, ensureAccountCredits, getAccountCredits } from "../../lib/credits.js";
import { isAppAuthenticated, isSpotifyConnected } from "../../lib/app-auth.js";
import { ensureValidSession } from "../../lib/spotify.js";
import { getSession, json, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
import { isSquareConfigured } from "../../lib/square.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!isAppAuthenticated(session)) {
    json(res, 200, { authenticated: false, spotifyConnected: false });
    return;
  }

  try {
    let account = await getAccountById(session.accountId);
    if (!account) {
      json(res, 200, { authenticated: false, spotifyConnected: false });
      return;
    }

    let valid = session;
    let supabaseError = null;

    if (isSpotifyConnected(session)) {
      try {
        valid = await ensureValidSession(session);
        if (!valid?.refresh_token) {
          valid = {
            accountId: session.accountId,
            username: session.username,
            email: session.email,
            displayName: session.displayName || account.username,
          };
        } else if (valid !== session) {
          save(valid);
        }
      } catch (err) {
        console.error("Spotify session refresh failed:", err.message);
        valid = {
          accountId: session.accountId,
          username: session.username,
          email: session.email,
          displayName: session.displayName || account.username,
        };
      }
    }

    if (valid.accountId) {
      try {
        account = await getAccountCredits(valid.accountId);
        if (valid.user) {
          account = await ensureAccountCredits(valid.user, account);
        }
      } catch (err) {
        console.error("Credit sync failed:", err.message);
        supabaseError = err.message;
      }
    }

    json(res, 200, {
      authenticated: true,
      spotifyConnected: isSpotifyConnected(valid),
      user: {
        name: valid.displayName || valid.username || account?.display_name || "User",
        username: valid.username || account?.username,
        email: valid.email || account?.email,
        accountId: valid.accountId,
        product: valid.user?.product || account?.product,
      },
      spotify: isSpotifyConnected(valid)
        ? {
            name: valid.user?.display_name || account?.display_name,
            product: valid.user?.product || account?.product,
          }
        : null,
      credits: account ? buildCreditStatus(account, valid.user) : null,
      squareConfigured: isSquareConfigured(),
      supabase: {
        synced: Boolean(valid.accountId),
        error: supabaseError,
      },
    });
  } catch {
    json(res, 200, { authenticated: false, spotifyConnected: false });
  }
}
