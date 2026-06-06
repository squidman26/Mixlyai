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
  if (!plan.action || !["create", "edit"].includes(plan.action)) {
    throw new Error('Plan must set action to "create" or "edit"');
  }
  if (!Array.isArray(plan.tracks) || plan.tracks.length === 0) {
    throw new Error("Plan must include a non-empty tracks array");
  }

  const normalized = {
    action: plan.action,
    playlist: plan.playlist ?? {},
    tracks: plan.tracks,
    _rows: rowsFromTracks(plan.tracks),
  };

  if (plan.action === "create" && !normalized.playlist.name) {
    throw new Error('Create plan needs playlist.name');
  }

  return normalized;
}

export function formatPlanSummary(plan) {
  const lines = [];
  lines.push(`Action: ${plan.action}`);

  if (plan.action === "create") {
    lines.push(`Name: ${plan.playlist.name}`);
    if (plan.playlist.description) {
      lines.push(`Description: ${plan.playlist.description}`);
    }
    lines.push(`Public: ${plan.playlist.public ? "yes" : "no"}`);
  } else {
    const ref = plan.playlist.url || plan.playlist.id || "(not set)";
    lines.push(`Playlist: ${ref}`);
    lines.push(`Mode: ${plan.playlist.mode || "sync"}`);
    if (plan.playlist.name) lines.push(`Rename: ${plan.playlist.name}`);
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
