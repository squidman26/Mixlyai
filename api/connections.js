import {
  buildConnectionsResponse,
  disconnectAccountConnection,
  listAccountConnections,
  upsertYoutubeConnection,
} from "../lib/connections.js";
import {
  clearYoutubeOAuthPending,
  isYoutubeOAuthConfigured,
  readYoutubeOAuthPending,
  setYoutubeOAuthPending,
} from "../lib/google-auth.js";
import {
  getSession,
  json,
  readJsonBody,
  requireAppSession,
  requireMethod,
} from "../lib/api.js";
import { getBaseUrl } from "../lib/config.js";
import { requireAccess } from "../lib/gate.js";

export default async function handler(req, res) {
  if (!requireAccess(req, res)) return;

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
              "YouTube connect is not configured. Add GOOGLE_CLIENT_ID and Supabase keys.",
          });
          return;
        }

        setYoutubeOAuthPending(res, { accountId: session.accountId });
        json(res, 200, {
          ok: true,
          redirectTo: `${getBaseUrl(req)}/?connections=youtube`,
        });
        return;
      }

      if (body.action === "complete-youtube") {
        const pending = readYoutubeOAuthPending(req);
        if (!pending || pending.accountId !== session.accountId) {
          json(res, 400, { error: "YouTube OAuth session expired. Try connecting again." });
          return;
        }

        if (!body.accessToken) {
          json(res, 400, { error: "Missing Google access token" });
          return;
        }

        await upsertYoutubeConnection(session.accountId, {
          accessToken: body.accessToken,
          refreshToken: body.refreshToken ?? null,
          expiresIn: body.expiresIn ?? 3600,
          externalId: body.externalId ?? null,
          displayName: body.displayName ?? null,
          scope: body.scope ?? null,
        });
        clearYoutubeOAuthPending(res);

        const connections = await listAccountConnections(session.accountId);
        json(res, 200, {
          ok: true,
          connections: buildConnectionsResponse(connections),
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
