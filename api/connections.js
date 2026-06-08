import crypto from "crypto";
import {
  buildConnectionsResponse,
  disconnectAccountConnection,
  listAccountConnections,
} from "../lib/connections.js";
import {
  buildGoogleAuthorizeUrl,
  generatePkcePair,
  isYoutubeOAuthConfigured,
  setYoutubeOAuthPending,
} from "../lib/google-auth.js";
import {
  getSession,
  json,
  readJsonBody,
  requireAppSession,
  requireMethod,
} from "../lib/api.js";
export default async function handler(req, res) {
  if (req.method === "GET") {
    const { session } = getSession(req, res);
    if (!requireAppSession(req, res, session)) return;

    try {
      const connections = await listAccountConnections(session.accountId);
      json(res, 200, {
        connections: buildConnectionsResponse(connections),
      });
    } catch (err) {
      json(res, 500, { error: err.message || "Failed to load connections" });
    }
    return;
  }

  if (req.method === "POST") {
    const { session } = getSession(req, res);
    if (!requireAppSession(req, res, session)) return;

    try {
      const body = await readJsonBody(req);

      if (body.action === "disconnect" && body.provider) {
        await disconnectAccountConnection(session.accountId, body.provider);
        const connections = await listAccountConnections(session.accountId);
        json(res, 200, {
          ok: true,
          connections: buildConnectionsResponse(connections),
        });
        return;
      }

      if (body.action === "connect" && body.provider === "youtube") {
        if (!isYoutubeOAuthConfigured()) {
          json(res, 503, {
            error:
              "YouTube connect is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
          });
          return;
        }

        const { codeVerifier, codeChallenge } = generatePkcePair();
        const state = crypto.randomBytes(16).toString("base64url");
        setYoutubeOAuthPending(res, {
          accountId: session.accountId,
          state,
          codeVerifier,
        });

        json(res, 200, {
          ok: true,
          authorizeUrl: buildGoogleAuthorizeUrl(req, { state, codeChallenge }),
        });
        return;
      }

      if (body.action === "connect" && body.provider) {
        json(res, 501, {
          error: `${body.provider} connect is coming soon.`,
        });
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
