import { exportMatchedCsv } from "../src/csv.js";
import { applyPlan } from "./apply.js";
import { normalizePlan } from "../src/plan.js";

export function buildExportRows(matched, skipped) {
  const rows = [];

  for (const item of matched) {
    rows.push({
      line: item.line,
      artist: item.artist,
      title: item.title,
      status: item.status || "matched",
      spotify_uri: item.uri,
      spotify_url: item.spotify_url,
      matched_label: item.label,
      reason: "",
    });
  }

  for (const item of skipped) {
    rows.push({
      line: item.line,
      artist: item.artist,
      title: item.title,
      status: "skipped",
      spotify_uri: "",
      spotify_url: "",
      matched_label: item.guess ?? "",
      reason: item.reason ?? "",
    });
  }

  rows.sort((a, b) => a.line - b.line);
  return rows;
}

export function buildExportCsv(matched, skipped) {
  return exportMatchedCsv(buildExportRows(matched, skipped));
}

export async function importAndMatch(session, { rows, playlistName, includeAmbiguous, dryRun }) {
  const plan = normalizePlan({
    action: "create",
    playlist: {
      name: playlistName || "Imported Playlist",
      description: "Imported via CSV",
      public: false,
    },
    tracks: rows,
  });

  const result = await applyPlan(session, plan, {
    dryRun,
    includeAmbiguous,
    useAppToken: true,
    exportOnly: !session?.refresh_token || dryRun,
  });

  const exportRows = buildExportRows(result.matched ?? [], result.summary.skipped);
  const exportCsv = buildExportCsv(result.matched ?? [], result.summary.skipped);

  return {
    ...result,
    exportRows,
    exportCsv,
    playlistName: plan.playlist.name,
  };
}
