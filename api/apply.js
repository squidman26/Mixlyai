import { saveGeneratedPlaylist } from "../lib/accounts.js";
import { applyPlan } from "../lib/apply.js";
import { getSession, json, readJsonBody, requireMethod } from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";
import { normalizePlan } from "../src/plan.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!session?.refresh_token) {
    json(res, 401, { error: "Connect Spotify first" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body.plan) {
      json(res, 400, { error: "plan required" });
      return;
    }

    const plan = normalizePlan(body.plan);
    const result = await applyPlan(session, plan, {
      dryRun: Boolean(body.dryRun),
      includeAmbiguous: Boolean(body.includeAmbiguous),
    });

    save(result.session);

    if (result.session.accountId && result.createdPlaylist) {
      try {
        await saveGeneratedPlaylist(
          result.session.accountId,
          result.createdPlaylist,
          result.summary.matched.length
        );
      } catch (err) {
        console.error("Supabase playlist sync failed:", err.message);
      }
    }

    json(res, 200, {
      summary: result.summary,
      playlistUrl: result.playlistUrl,
      playlistName: result.playlistName,
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Apply failed" });
  }
}
