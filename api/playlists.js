import { listGeneratedPlaylists } from "../lib/accounts.js";
import { getUserPlaylists } from "../lib/spotify.js";
import { mergeGeneratedPlaylists } from "../lib/playlists.js";
import { getSession, json, requireAppSession, requireMethod } from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session: initialSession, save } = getSession(req, res);
  if (!requireAppSession(req, res, initialSession)) return;

  try {
    let session = initialSession;
    let spotifyPlaylists = [];
    if (session.refresh_token) {
      const result = await getUserPlaylists(session, 50);
      spotifyPlaylists = result.playlists;
      session = result.session;
    }

    let storedPlaylists = session.generatedPlaylists ?? [];

    if (session.accountId) {
      try {
        storedPlaylists = await listGeneratedPlaylists(session.accountId);
      } catch (err) {
        console.error("Supabase playlist load failed:", err.message);
      }
    }

    const playlists = mergeGeneratedPlaylists(storedPlaylists, spotifyPlaylists);

    save({
      ...session,
      generatedPlaylists: playlists,
    });

    json(res, 200, { playlists, spotifyConnected: Boolean(session.refresh_token) });
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to load playlists" });
  }
}
