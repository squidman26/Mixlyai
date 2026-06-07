import {
  authenticateAppAccount,
  createAppAccount,
  getAccountById,
  linkSpotifyToAccount,
  clearSpotifyConnection,
} from "./accounts.js";
import { ensureValidSession, getCurrentUser } from "./spotify.js";

export async function signUp({ email, username, password }) {
  const account = await createAppAccount({ email, username, password });
  return buildAppSession(account);
}

export async function signIn({ login, password }) {
  const account = await authenticateAppAccount({ login, password });
  if (!account) return null;

  let session = {
    accountId: account.id,
    username: account.username,
    email: account.email,
    displayName: account.display_name || account.username,
  };

  if (account.spotify_refresh_token) {
    session = {
      ...session,
      access_token: account.spotify_access_token ?? undefined,
      refresh_token: account.spotify_refresh_token,
      expires_at: account.spotify_token_expires_at
        ? new Date(account.spotify_token_expires_at).getTime()
        : 0,
    };

    try {
      const valid = await ensureValidSession(session);
      if (valid?.refresh_token) {
        const { session: withUser, data: user } = await getCurrentUser(valid);
        session = { ...withUser, ...session, user };
        await linkSpotifyToAccount(account.id, withUser, user);
      }
    } catch (err) {
      console.error("Spotify token restore failed:", err.message);
      session = {
        accountId: account.id,
        username: account.username,
        email: account.email,
        displayName: account.display_name || account.username,
      };
    }
  }

  return session;
}

export async function attachSpotifyToSession(appSession, spotifySession) {
  if (!appSession?.accountId) {
    throw new Error("Sign in before connecting Spotify");
  }

  const account = await linkSpotifyToAccount(
    appSession.accountId,
    spotifySession,
    spotifySession.user
  );

  return {
    ...appSession,
    access_token: spotifySession.access_token,
    refresh_token: spotifySession.refresh_token,
    expires_at: spotifySession.expires_at,
    user: spotifySession.user,
    accountId: account.id,
    supabaseSyncedAt: Date.now(),
  };
}

export async function disconnectSpotify(session) {
  if (!session?.accountId) return session;

  await clearSpotifyConnection(session.accountId);

  const account = await getAccountById(session.accountId);
  return {
    accountId: session.accountId,
    username: account?.username ?? session.username,
    email: account?.email ?? session.email,
    displayName: account?.display_name || account?.username || session.displayName,
  };
}

export function buildAppSession(account) {
  return {
    accountId: account.id,
    username: account.username,
    email: account.email,
    displayName: account.display_name || account.username,
  };
}

export function isAppAuthenticated(session) {
  return Boolean(session?.accountId);
}

export function isSpotifyConnected(session) {
  return Boolean(session?.refresh_token);
}
