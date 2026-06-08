import { savePlaylist } from "../lib/accounts.js";
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
import { applyPlanToYoutube } from "../lib/youtube-apply.js";
import { itemsToCsv } from "../src/csv.js";
import { getPlanItems, normalizePlan } from "../src/plan.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  try {
    const body = await readJsonBody(req);
    if (!body.plan) {
      json(res, 400, { error: "plan required" });
      return;
    }

    const plan = normalizePlan(body.plan);
    const applyTo = body.applyTo?.trim().toLowerCase();

    const creditResult = await deductCredits(
      session.accountId,
      CREDIT_COSTS.exportPlaylist,
      null
    );
    if (!creditResult.ok) {
      respondInsufficientCredits(res, creditResult);
      return;
    }

    let youtube = null;
    let itemsForSave = getPlanItems(plan);

    if (applyTo === "youtube") {
      youtube = await applyPlanToYoutube(session.accountId, plan);
      itemsForSave = youtube.tracksJson;
    } else if (applyTo) {
      json(res, 400, { error: `Unsupported apply target: ${applyTo}` });
      return;
    }

    const saved = await savePlaylist(
      session.accountId,
      plan,
      applyTo === "youtube"
        ? {
            tracksJson: itemsForSave,
            provider: "youtube",
            externalPlaylistId: youtube?.playlist?.id ?? null,
            externalPlaylistUrl: youtube?.playlist?.url ?? null,
          }
        : {}
    );

    json(res, 200, {
      saved: Boolean(saved),
      playlist: saved
        ? {
            id: saved.playlist_slug,
            name: saved.name,
            description: saved.description,
            tracks: saved.track_count,
            provider: saved.provider ?? null,
            externalPlaylistUrl: saved.external_playlist_url ?? null,
          }
        : null,
      csv: itemsToCsv(itemsForSave, { includeYoutube: Boolean(youtube) }),
      json: itemsForSave,
      youtube,
      credits: creditResult.unlimited ? null : creditResult.credits,
      unlimitedCredits: creditResult.unlimited,
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Export failed" });
  }
}
