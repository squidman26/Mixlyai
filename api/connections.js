import {
  buildConnectionsResponse,
  disconnectAccountConnection,
  listAccountConnections,
} from "../lib/connections.js";
import {
  getSession,
  json,
  readJsonBody,
  requireAppSession,
  requireMethod,
} from "../lib/api.js";
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

      if (body.action === "connect" && body.provider) {
        json(res, 501, {
          error: `${body.provider} connect is coming soon. OAuth setup is not enabled yet.`,
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
