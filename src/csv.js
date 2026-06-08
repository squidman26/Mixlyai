import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { parseYoutubeVideoId } from "../lib/youtube-id.js";

const ARTIST_KEYS = ["artist", "artists", "artist name", "artist_name"];
const TITLE_KEYS = [
  "title",
  "song",
  "track",
  "name",
  "song title",
  "song_title",
  "track name",
  "track_name",
];

function normalizeKey(key) {
  return key.trim().toLowerCase();
}

function pickColumn(record, candidates) {
  const keys = Object.keys(record);
  for (const key of keys) {
    if (candidates.includes(normalizeKey(key))) {
      return record[key]?.trim();
    }
  }
  return null;
}

export function normalizePlanItem(raw, index) {
  const type = raw?.type === "video" ? "video" : "track";

  if (type === "video") {
    const title = raw.title?.trim() || "";
    const channel = raw.channel?.trim() || raw.channelTitle?.trim() || "";
    const youtubeUrl = raw.youtubeUrl?.trim() || raw.url?.trim() || "";
    const youtubeVideoId =
      raw.youtubeVideoId?.trim() || parseYoutubeVideoId(youtubeUrl) || "";
    const searchQuery = raw.searchQuery?.trim() || "";

    if (!title && !youtubeUrl && !youtubeVideoId && !searchQuery) {
      throw new Error(
        `Item ${index + 1}: videos need a title, YouTube URL, or search query`
      );
    }

    return {
      type: "video",
      title: title || "YouTube video",
      channel,
      youtubeUrl,
      youtubeVideoId,
      searchQuery,
    };
  }

  const artist = raw.artist?.trim();
  const title = raw.title?.trim();
  if (!artist || !title) {
    throw new Error(`Item ${index + 1}: songs need artist and title`);
  }

  return { type: "track", artist, title };
}

export function normalizePlanItems(items) {
  if (!items?.length) {
    throw new Error("Playlist plan has no items");
  }
  return items.map((item, index) => normalizePlanItem(item, index));
}

export function rowsFromItems(items) {
  return normalizePlanItems(items).map((item, index) => {
    if (item.type === "video") {
      return {
        type: "video",
        title: item.title,
        channel: item.channel,
        line: index + 1,
      };
    }
    return {
      type: "track",
      artist: item.artist,
      title: item.title,
      line: index + 1,
    };
  });
}

export function rowsFromTracks(tracks) {
  return rowsFromItems(tracks);
}

export function formatItemLabel(item) {
  if (item.type === "video") {
    return item.channel ? `${item.channel} — ${item.title}` : item.title;
  }
  return `${item.artist} — ${item.title}`;
}

export function itemsToCsv(items, { includeYoutube = false } = {}) {
  const header = includeYoutube
    ? "type,artist,title,channel,youtube_url"
    : "type,artist,title,channel";
  const rows = normalizePlanItems(items).map((item) => {
    const type = `"${item.type}"`;
    const artist = `"${String(item.artist || "").replace(/"/g, '""')}"`;
    const title = `"${String(item.title || "").replace(/"/g, '""')}"`;
    const channel = `"${String(item.channel || "").replace(/"/g, '""')}"`;
    if (!includeYoutube) {
      return `${type},${artist},${title},${channel}`;
    }
    const url = `"${String(item.youtubeUrl || "").replace(/"/g, '""')}"`;
    return `${type},${artist},${title},${channel},${url}`;
  });
  return [header, ...rows].join("\n");
}

export function parseTrackCsv(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (records.length === 0) {
    throw new Error("CSV is empty");
  }

  const rows = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    let artist = pickColumn(record, ARTIST_KEYS);
    let title = pickColumn(record, TITLE_KEYS);

    if (!artist || !title) {
      const values = Object.values(record).map((v) => v?.trim()).filter(Boolean);
      if (values.length >= 2 && !artist && !title) {
        artist = values[0];
        title = values[1];
      }
    }

    if (!artist || !title) {
      throw new Error(
        `Row ${i + 2}: need artist and title columns (e.g. artist,title). Got: ${Object.keys(record).join(", ")}`
      );
    }

    rows.push({ artist, title, line: i + 2 });
  }

  return rows;
}
