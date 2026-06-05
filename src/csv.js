import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

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

export function rowsFromTracks(tracks) {
  if (!tracks?.length) {
    throw new Error("Playlist plan has no tracks");
  }
  return tracks.map((t, i) => {
    const artist = t.artist?.trim();
    const title = t.title?.trim();
    if (!artist || !title) {
      throw new Error(`Track ${i + 1} needs artist and title`);
    }
    return { artist, title, line: i + 1 };
  });
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
