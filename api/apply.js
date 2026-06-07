import { saveGeneratedPlaylist } from "../lib/accounts.js";
import { applyPlan } from "../lib/apply.js";
import {
  getSession,
  json,
  readJsonBody,
  requireMethod,
  respondInsufficientCredits,
} from "../lib/api.js";
import { requireAccess } from "../lib/gate.js";
import { CREDIT_COSTS, deductCredits } from "../lib/credits.js";
import { normalizePlan } from "../src/plan.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  const { session, save } = getSession(req, res);
  if (!session?.refresh_token || !session?.provider) {
    json(res, 401, { error: "Connect YouTube Music or SoundCloud first" });
    return;
  }

  if (!session.accountId) {
    json(res, 400, { error: "Account not synced yet. Refresh and try again." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (!body.plan) {
      json(res, 400, { error: "plan required" });
      return;
    }

    const dryRun = Boolean(body.dryRun);
    let creditResult = null;

    if (!dryRun) {
      creditResult = await deductCredits(
        session.accountId,
        CREDIT_COSTS.applyPlaylist,
        session.user
      );
      if (!creditResult.ok) {
        respondInsufficientCredits(res, creditResult);
        return;
      }
    }

    const plan = normalizePlan(body.plan);
    const result = await applyPlan(session, plan, {
      dryRun,
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
      credits: creditResult?.unlimited ? null : creditResult?.credits ?? null,
      unlimitedCredits: creditResult?.unlimited ?? false,
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Apply failed" });
  }
}
