import { matchTrack, formatTrack } from "./match.js";

export async function matchRowsFromCsv(rows, { includeAmbiguous }) {
  const matched = [];
  const skipped = [];

  for (const row of rows) {
    const result = await matchTrack(row.artist, row.title);

    if (result.status === "not_found") {
      skipped.push({ ...row, reason: "not found on Spotify" });
      console.log(
        `✗  line ${row.line}: ${row.artist} — ${row.title} (not found)`
      );
      continue;
    }

    if (result.status === "ambiguous" && !includeAmbiguous) {
      skipped.push({
        ...row,
        reason: `low confidence (score ${result.score.toFixed(0)})`,
        guess: formatTrack(result.track),
      });
      console.log(
        `?  line ${row.line}: ${row.artist} — ${row.title} → ${formatTrack(result.track)} (skipped; use --include-ambiguous)`
      );
      continue;
    }

    const label = result.status === "ambiguous" ? "~" : "✓";
    console.log(
      `${label}  line ${row.line}: ${row.artist} — ${row.title} → ${formatTrack(result.track)}`
    );
    matched.push(result.track);
  }

  return { matched, skipped };
}

export function printMatchSummary(matched, skipped, rows) {
  console.log(`\nMatched ${matched.length} / ${rows.length} tracks`);

  if (skipped.length > 0) {
    console.log("\nSkipped:");
    for (const s of skipped) {
      const extra = s.guess ? ` (best: ${s.guess})` : "";
      console.log(
        `  line ${s.line}: ${s.artist} — ${s.title} — ${s.reason}${extra}`
      );
    }
  }
}
