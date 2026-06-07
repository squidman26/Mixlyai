import { signUp } from "../../lib/app-auth.js";
import { getSession, json, readJsonBody, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  try {
    const body = await readJsonBody(req);
    const session = await signUp({
      email: body.email,
      username: body.username,
      password: body.password,
    });

    const { save } = getSession(req, res);
    save(session);

    json(res, 200, {
      ok: true,
      user: {
        name: session.displayName,
        username: session.username,
        email: session.email,
        accountId: session.accountId,
      },
    });
  } catch (err) {
    json(res, 400, { error: err.message || "Sign up failed" });
  }
}
