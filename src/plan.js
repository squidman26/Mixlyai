import { rowsFromTracks } from "./csv.js";

const BLOCK_RE = /```playlist\s*([\s\S]*?)```/i;

export function extractPlanFromMessage(text) {
  const match = text.match(BLOCK_RE);
  if (!match) return null;

  try {
    const plan = JSON.parse(match[1].trim());
    if (!plan.ready) return null;
    return normalizePlan(plan);
  } catch {
    return null;
  }
}

export function stripPlanBlock(text) {
  return text.replace(BLOCK_RE, "").trim();
}

export function normalizePlan(plan) {
  if (!plan.playlist?.name) {
    throw new Error("Plan must include playlist.name");
  }
  if (!Array.isArray(plan.tracks) || plan.tracks.length === 0) {
    throw new Error("Plan must include a non-empty tracks array");
  }

  return {
    playlist: {
      name: plan.playlist.name,
      description: plan.playlist.description ?? "",
    },
    tracks: plan.tracks,
    _rows: rowsFromTracks(plan.tracks),
  };
}

export function formatPlanSummary(plan) {
  const lines = [];
  lines.push(`Name: ${plan.playlist.name}`);
  if (plan.playlist.description) {
    lines.push(`Description: ${plan.playlist.description}`);
  }
  lines.push(`Tracks: ${plan.tracks.length}`);
  const preview = plan.tracks.slice(0, 8);
  for (const t of preview) {
    lines.push(`  • ${t.artist} — ${t.title}`);
  }
  if (plan.tracks.length > 8) {
    lines.push(`  … and ${plan.tracks.length - 8} more`);
  }
  return lines.join("\n");
}
