import { parsePlaylistId } from "../src/playlist-id.js";
import { matchRow, matchRowApp, formatTrack } from "./match.js";
import { playlistDescription, recordGeneratedPlaylist } from "./playlists.js";
import {
  createPlaylist,
  addTracksToPlaylist,
  getPlaylist,
  getAllPlaylistTrackUris,
  replacePlaylistTracks,
  updatePlaylist,
} from "./spotify.js";

async function matchRows(session, rows, { includeAmbiguous, useAppToken }) {
  const matched = [];
  const skipped = [];
  let s = session;

  for (const row of rows) {
    const result = useAppToken
      ? await matchRowApp(row.artist, row.title)
      : await matchRow(s, row.artist, row.title);

    if (!useAppToken && result.session) {
      s = result.session;
    }

    if (result.status === "not_found") {
      skipped.push({ ...row, reason: "not found on Spotify" });
      continue;
    }

    if (result.status === "ambiguous" && !includeAmbiguous) {
      skipped.push({
        ...row,
        reason: `low confidence (score ${result.score.toFixed(0)})`,
        guess: formatTrack(result.track),
      });
      continue;
    }

    matched.push({
      uri: result.track.uri,
      label: formatTrack(result.track),
      line: row.line,
      artist: row.artist,
      title: row.title,
      spotify_url: result.track.external_urls?.spotify ?? null,
      status: result.status,
    });
  }

  return { session: s, matched, skipped };
}

export async function applyPlan(session, plan, opts) {
  const rows = plan._rows;
  const useAppToken = Boolean(opts.useAppToken);
  const { session: s1, matched, skipped } = await matchRows(session, rows, {
    includeAmbiguous: opts.includeAmbiguous,
    useAppToken,
  });

  const summary = {
    matched: matched.map((m) => ({ line: m.line, label: m.label })),
    skipped,
    total: rows.length,
    dryRun: Boolean(opts.dryRun),
  };

  if (opts.dryRun || matched.length === 0 || opts.exportOnly) {
    if (matched.length === 0 && !opts.dryRun) {
      throw new Error(
        "No tracks matched. Adjust the list or enable uncertain matches."
      );
    }
    return { session: s1, summary, playlistUrl: null, matched };
  }

  if (!session?.refresh_token) {
    throw new Error("Connect Spotify to create playlists in your library");
  }

  const uris = matched.map((m) => m.uri);
  let s = s1;

  if (plan.action === "create") {
    const meta = plan.playlist ?? {};
    const { session: s2, playlist } = await createPlaylist(
      s,
      meta.name || "New Playlist",
      playlistDescription(meta),
      Boolean(meta.public)
    );
    s = await addTracksToPlaylist(s2, playlist.id, uris);
    s = recordGeneratedPlaylist(s, playlist, uris.length);
    return {
      session: s,
      summary,
      playlistUrl: playlist.external_urls.spotify,
      playlistName: playlist.name,
      createdPlaylist: playlist,
    };
  }

  if (plan.action === "edit") {
    const meta = plan.playlist ?? {};
    const playlistRef = meta.url || meta.id;
    if (!playlistRef) throw new Error("Edit plan needs playlist.url or playlist.id");

    const playlistId = parsePlaylistId(playlistRef);
    const { session: s2, playlist } = await getPlaylist(s, playlistId);
    s = s2;

    if (meta.name || meta.description !== undefined || meta.public !== undefined) {
      s = await updatePlaylist(s, playlistId, {
        name: meta.name,
        description: meta.description,
        public: meta.public,
      });
    }

    const mode = (meta.mode || "sync").toLowerCase();
    if (mode === "sync") {
      s = await replacePlaylistTracks(s, playlistId, uris);
    } else {
      const { session: s3, uris: existingUris } = await getAllPlaylistTrackUris(
        s,
        playlistId
      );
      s = s3;
      const existing = new Set(existingUris);
      const newUris = uris.filter((uri) => !existing.has(uri));
      if (newUris.length > 0) {
        s = await addTracksToPlaylist(s, playlistId, newUris);
      }
    }

    const { session: s4, playlist: updated } = await getPlaylist(s, playlistId);
    return {
      session: s4,
      summary,
      playlistUrl: updated.external_urls.spotify,
      playlistName: updated.name,
    };
  }

  throw new Error(`Unknown plan action: ${plan.action}`);
}
