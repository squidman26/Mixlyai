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
    const valid = await ensureValidSession(session);
    if (!valid) {
      json(res, 200, { authenticated: false });
      return;
    }
    save(valid);
    json(res, 200, {
      authenticated: true,
      user: {
        name: valid.user?.display_name || "Spotify User",
        id: valid.user?.id,
        product: valid.user?.product,
      },
    });
  } catch {
    json(res, 200, { authenticated: false });
  }
}
