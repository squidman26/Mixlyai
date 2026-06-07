import { importAndMatch } from "../lib/import.js";
import { parseTrackCsvText } from "../src/csv.js";
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

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  try {
    const body = await readJsonBody(req);
    const csv = body.csv;
    if (!csv?.trim()) {
      json(res, 400, { error: "csv required" });
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

    const rows = parseTrackCsvText(csv);
    const result = await importAndMatch(session, {
      rows,
      playlistName: body.playlistName,
      includeAmbiguous: Boolean(body.includeAmbiguous),
      dryRun,
    });

    json(res, 200, {
      summary: result.summary,
      exportCsv: result.exportCsv,
      exportRows: result.exportRows,
      playlistName: result.playlistName,
      playlistUrl: result.playlistUrl,
      credits: creditResult?.unlimited ? null : creditResult?.credits ?? null,
      unlimitedCredits: creditResult?.unlimited ?? false,
      spotifyConnected: Boolean(session.refresh_token),
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Import failed" });
  }
}
