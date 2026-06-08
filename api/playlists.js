import { listSavedPlaylists } from "../lib/accounts.js";
import { getSession, json, requireAppSession, requireMethod } from "../lib/api.js";
export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  try {
    const playlists = await listSavedPlaylists(session.accountId);
    json(res, 200, { playlists });
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to load playlists" });
  }
}
