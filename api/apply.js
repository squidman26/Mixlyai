import { saveGeneratedPlaylist } from "../lib/accounts.js";
import { applyPlan } from "../lib/apply.js";
import { buildExportCsv } from "../lib/import.js";
import {
  getSession,
  json,
  readJsonBody,
  requireAppSession,
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
  if (!requireAppSession(req, res, session)) return;

  try {
    const body = await readJsonBody(req);
    if (!body.plan) {
      json(res, 400, { error: "plan required" });
      return;
    }

    const dryRun = Boolean(body.dryRun);
    const spotifyConnected = Boolean(session.refresh_token);
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
      useAppToken: !spotifyConnected,
      exportOnly: !spotifyConnected || dryRun,
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

    const exportCsv =
      !spotifyConnected || dryRun
        ? buildExportCsv(result.matched ?? [], result.summary.skipped)
        : null;

    json(res, 200, {
      summary: result.summary,
      playlistUrl: result.playlistUrl,
      playlistName: result.playlistName,
      exportCsv,
      spotifyConnected,
      credits: creditResult?.unlimited ? null : creditResult?.credits ?? null,
      unlimitedCredits: creditResult?.unlimited ?? false,
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Apply failed" });
  }
}
