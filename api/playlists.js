import { listGeneratedPlaylists } from "../lib/accounts.js";
import { getUserPlaylists } from "../lib/spotify.js";
import { mergeGeneratedPlaylists } from "../lib/playlists.js";
import { getSession, json, requireMethod, requireSpotifySession } from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!requireSpotifySession(req, res, session)) return;

  try {
    const result = await getUserPlaylists(session, 50);
    let storedPlaylists = session.generatedPlaylists ?? [];

    if (session.accountId) {
      try {
        storedPlaylists = await listGeneratedPlaylists(session.accountId);
      } catch (err) {
        console.error("Supabase playlist load failed:", err.message);
      }
    }

    const playlists = mergeGeneratedPlaylists(storedPlaylists, result.playlists);

    save({
      ...result.session,
      generatedPlaylists: playlists,
    });

    json(res, 200, { playlists });
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to load playlists" });
  }
}
