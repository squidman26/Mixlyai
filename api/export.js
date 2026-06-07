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
import { applyPlanToSoundCloud } from "../lib/soundcloud-apply.js";
import { normalizePlan } from "../src/plan.js";

function tracksToCsv(tracks, { includeSoundCloud = false } = {}) {
  const header = includeSoundCloud ? "artist,title,soundcloud_url" : "artist,title";
  const rows = tracks.map((t) => {
    const artist = `"${String(t.artist).replace(/"/g, '""')}"`;
    const title = `"${String(t.title).replace(/"/g, '""')}"`;
    if (!includeSoundCloud) return `${artist},${title}`;
    const url = `"${String(t.soundcloudUrl || "").replace(/"/g, '""')}"`;
    return `${artist},${title},${url}`;
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

    let soundcloud = null;
    let tracksForSave = plan.tracks;

    if (applyTo === "soundcloud") {
      soundcloud = await applyPlanToSoundCloud(session.accountId, plan);
      tracksForSave = soundcloud.tracksJson;
    } else if (applyTo) {
      json(res, 400, { error: `Unsupported apply target: ${applyTo}` });
      return;
    }

    const saved = await savePlaylist(
      session.accountId,
      plan,
      applyTo === "soundcloud"
        ? {
            tracksJson: tracksForSave,
            provider: "soundcloud",
            externalPlaylistId:
              soundcloud?.playlist?.urn ||
              (soundcloud?.playlist?.id != null
                ? String(soundcloud.playlist.id)
                : null),
            externalPlaylistUrl: soundcloud?.playlist?.permalinkUrl ?? null,
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
      csv: tracksToCsv(tracksForSave, { includeSoundCloud: Boolean(soundcloud) }),
      json: tracksForSave,
      soundcloud,
      credits: creditResult.unlimited ? null : creditResult.credits,
      unlimitedCredits: creditResult.unlimited,
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Export failed" });
  }
}
