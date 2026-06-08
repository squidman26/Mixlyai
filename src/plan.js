import {
  formatItemLabel,
  normalizePlanItems,
  rowsFromItems,
} from "./csv.js";

const BLOCK_RE = /```playlist\s*([\s\S]*?)```/i;

export function getPlanItems(plan) {
  return plan?.items ?? plan?.tracks ?? [];
}

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

  const rawItems = getPlanItems(plan);
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Plan must include a non-empty items array");
  }

  const items = normalizePlanItems(rawItems);

  return {
    playlist: {
      name: plan.playlist.name,
      description: plan.playlist.description ?? "",
    },
    items,
    tracks: items,
    _rows: rowsFromItems(items),
  };
}

export function formatPlanSummary(plan) {
  const items = getPlanItems(plan);
  const trackCount = items.filter((item) => item.type !== "video").length;
  const videoCount = items.filter((item) => item.type === "video").length;
  const lines = [];

  lines.push(`Name: ${plan.playlist.name}`);
  if (plan.playlist.description) {
    lines.push(`Description: ${plan.playlist.description}`);
  }

  const countParts = [];
  if (trackCount) countParts.push(`${trackCount} song${trackCount === 1 ? "" : "s"}`);
  if (videoCount) countParts.push(`${videoCount} video${videoCount === 1 ? "" : "s"}`);
  lines.push(`Items: ${items.length}${countParts.length ? ` (${countParts.join(", ")})` : ""}`);

  const preview = items.slice(0, 8);
  for (const item of preview) {
    if (item.type === "video") {
      lines.push(`  • [video] ${formatItemLabel(item)}`);
    } else {
      lines.push(`  • ${formatItemLabel(item)}`);
    }
  }
  if (items.length > 8) {
    lines.push(`  … and ${items.length - 8} more`);
  }

  return lines.join("\n");
}
