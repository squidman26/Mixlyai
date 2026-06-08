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
import { normalizePlan } from "../src/plan.js";

function tracksToCsv(tracks) {
  const header = "artist,title";
  const rows = tracks.map((t) => {
    const artist = `"${String(t.artist).replace(/"/g, '""')}"`;
    const title = `"${String(t.title).replace(/"/g, '""')}"`;
    return `${artist},${title}`;
  });
  return [header, ...rows].join("\n");
}

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

    const creditResult = await deductCredits(
      session.accountId,
      CREDIT_COSTS.exportPlaylist,
      null
    );
    if (!creditResult.ok) {
      respondInsufficientCredits(res, creditResult);
      return;
    }

    const saved = await savePlaylist(session.accountId, plan);

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
      csv: tracksToCsv(plan.tracks),
      json: plan.tracks,
      credits: creditResult.unlimited ? null : creditResult.credits,
      unlimitedCredits: creditResult.unlimited,
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Export failed" });
  }
}
