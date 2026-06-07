import { signupUser } from "../../lib/app-auth.js";
import { json, readJsonBody, requireMethod } from "../../lib/api.js";
import { requireAccess } from "../../lib/gate.js";
import { setSessionCookie } from "../../lib/session.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  try {
    const body = await readJsonBody(req);
    const session = await signupUser({
      email: body.email,
      username: body.username,
      password: body.password,
    });

    setSessionCookie(res, session);
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
    json(res, 400, { error: err.message || "Signup failed" });
  }
}
