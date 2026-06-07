import { signIn } from "../../lib/app-auth.js";
import { getSession, json, readJsonBody, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  try {
    const body = await readJsonBody(req);
    const session = await signIn({
      login: body.login,
      password: body.password,
    });

    if (!session) {
      json(res, 401, { error: "Invalid email/username or password" });
      return;
    }

    const { save } = getSession(req, res);
    save(session);

    json(res, 200, {
      ok: true,
      user: {
        name: session.displayName || session.username,
        username: session.username,
        email: session.email,
        accountId: session.accountId,
      },
      spotifyConnected: Boolean(session.refresh_token),
    });
  } catch (err) {
    json(res, 400, { error: err.message || "Sign in failed" });
  }
}
