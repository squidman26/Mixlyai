import { getUserPlaylists } from "../lib/spotify.js";
import { mergeGeneratedPlaylists } from "../lib/playlists.js";
import { getSession, json, requireMethod } from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!session?.refresh_token) {
    json(res, 401, { error: "Connect Spotify first" });
    return;
  }

  try {
    const result = await getUserPlaylists(session, 50);
    const playlists = mergeGeneratedPlaylists(
      session.generatedPlaylists,
      result.playlists
    );

    save({
      ...result.session,
      generatedPlaylists: playlists,
    });

    json(res, 200, { playlists });
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to load playlists" });
  }
}
