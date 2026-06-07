import { disconnectSpotify, isSpotifyConnected } from "../lib/app-auth.js";
import { getAccountById } from "../lib/accounts.js";
import {
  getSession,
  json,
  readJsonBody,
  requireAppSession,
  requireMethod,
} from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";

async function getConnections(req, res) {
  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  const account = await getAccountById(session.accountId);
  const spotifyConnected = isSpotifyConnected(session);

  json(res, 200, {
    connections: [
      {
        provider: "spotify",
        connected: spotifyConnected,
        name: spotifyConnected
          ? session.user?.display_name || account?.display_name || "Spotify"
          : null,
        product: spotifyConnected ? session.user?.product || account?.product : null,
        linkedAt: account?.updated_at ?? null,
      },
    ],
  });
}

async function disconnectSpotifyConnection(req, res) {
  const { session, save } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  const nextSession = await disconnectSpotify(session);
  save(nextSession);
  json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  if (!requireAccess(req, res)) return;

  if (req.method === "GET") {
    await getConnections(req, res);
    return;
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (body.action === "disconnect" && body.provider === "spotify") {
        await disconnectSpotifyConnection(req, res);
        return;
      }
      json(res, 400, { error: "Unknown connection action" });
    } catch (err) {
      json(res, 500, { error: err.message || "Connection update failed" });
    }
    return;
  }

  requireMethod(req, res, "GET");
}
