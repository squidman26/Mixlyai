import { parsePlaylistId } from "./playlist-id.js";
import { matchRowsFromCsv, printMatchSummary } from "./match-rows.js";
import {
  createPlaylist,
  addTracksToPlaylist,
  getPlaylist,
  getAllPlaylistTrackUris,
  replacePlaylistTracks,
  updatePlaylist,
} from "./spotify.js";

export async function runMatchAndApply(rows, opts, apply) {
  console.log(`\nMatching ${rows.length} track(s) on Spotify...\n`);

  const { matched, skipped } = await matchRowsFromCsv(rows, {
    includeAmbiguous: opts.includeAmbiguous,
  });
  printMatchSummary(matched, skipped, rows);

  if (opts.dryRun) {
    console.log("\nDry run — no changes made.");
    return { matched, skipped };
  }

  if (matched.length === 0) {
    throw new Error(
      "No tracks matched. Adjust the list or use --include-ambiguous."
    );
  }

  await apply(matched.map((t) => t.uri));
  return { matched, skipped };
}

export async function applyCreatePlan(plan, opts) {
  const meta = plan.playlist ?? {};
  const rows = plan._rows;

  await runMatchAndApply(rows, opts, async (uris) => {
    const playlist = await createPlaylist(
      meta.name || "New Playlist",
      meta.description ?? "Created with playlist-builder",
      Boolean(meta.public)
    );
    await addTracksToPlaylist(playlist.id, uris);
    console.log(`\nPlaylist created: ${playlist.name}`);
    console.log(playlist.external_urls.spotify);
  });
}

export async function applyEditPlan(plan, opts) {
  const meta = plan.playlist ?? {};
  const playlistRef = meta.url || meta.id;
  if (!playlistRef) {
    throw new Error("Edit plan needs playlist.url or playlist.id");
  }

  const playlistId = parsePlaylistId(playlistRef);
  const playlist = await getPlaylist(playlistId);
  console.log(`\nPlaylist: ${playlist.name}`);

  if (meta.name || meta.description !== undefined || meta.public !== undefined) {
    if (!opts.dryRun) {
      await updatePlaylist(playlistId, {
        name: meta.name,
        description: meta.description,
        public: meta.public,
      });
      console.log("Updated playlist metadata.");
    } else {
      console.log("(dry run) Would update playlist metadata.");
    }
  }

  const mode = (meta.mode || plan.editMode || "sync").toLowerCase();
  if (mode !== "sync" && mode !== "add") {
    throw new Error('edit mode must be "sync" or "add"');
  }

  const rows = plan._rows;

  await runMatchAndApply(rows, opts, async (uris) => {
    if (mode === "sync") {
      const existing = await getAllPlaylistTrackUris(playlistId);
      const same =
        existing.length === uris.length &&
        existing.every((uri, i) => uri === uris[i]);

      if (same) {
        console.log("\nPlaylist already matches — no track changes needed.");
      } else {
        await replacePlaylistTracks(playlistId, uris);
        console.log(
          `\nSynced ${uris.length} tracks (was ${existing.length} tracks).`
        );
      }
    } else {
      const existing = new Set(await getAllPlaylistTrackUris(playlistId));
      const newUris = uris.filter((uri) => !existing.has(uri));

      if (newUris.length === 0) {
        console.log("\nAll matched tracks are already on the playlist.");
      } else {
        await addTracksToPlaylist(playlistId, newUris);
        console.log(`\nAdded ${newUris.length} new track(s).`);
      }
    }

    const updated = await getPlaylist(playlistId);
    console.log(updated.external_urls.spotify);
  });
}

export async function applyPlan(plan, opts) {
  if (plan.action === "create") {
    await applyCreatePlan(plan, opts);
  } else if (plan.action === "edit") {
    await applyEditPlan(plan, opts);
  } else {
    throw new Error(`Unknown plan action: ${plan.action}`);
  }
}
