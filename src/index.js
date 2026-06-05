#!/usr/bin/env node

import { Command } from "commander";
import { parseTrackCsv } from "./csv.js";
import { parsePlaylistId } from "./playlist-id.js";
import {
  login,
  getPlaylist,
  updatePlaylist,
  getUserPlaylists,
} from "./spotify.js";
import { runMatchAndApply, applyCreatePlan, applyEditPlan } from "./manager.js";
import { runChat } from "./chat.js";

const program = new Command();

program
  .name("playlist-builder")
  .description("Build and edit Spotify playlists with Claude or CSV");

program
  .command("chat", { isDefault: true })
  .description("Chat with Claude to design a playlist, then apply to Spotify")
  .action(async () => {
    await runChat();
  });

program
  .command("auth")
  .description("Log in to Spotify (required once)")
  .action(async () => {
    await login();
  });

program
  .command("list")
  .description("List your Spotify playlists (name and ID)")
  .option("-l, --limit <n>", "Max playlists to show", "50")
  .action(async (opts) => {
    const playlists = await getUserPlaylists(Number(opts.limit));
    if (playlists.length === 0) {
      console.log("No playlists found.");
      return;
    }
    for (const p of playlists) {
      const tracks = p.tracks?.total ?? "?";
      console.log(`${p.id}  ${p.name}  (${tracks} tracks)`);
      console.log(`  ${p.external_urls.spotify}\n`);
    }
  });

program
  .command("build")
  .description("Match CSV rows and create a new playlist")
  .requiredOption("-f, --file <path>", "CSV file path")
  .requiredOption("-n, --name <name>", "Playlist name")
  .option("-d, --description <text>", "Playlist description")
  .option("--public", "Make playlist public", false)
  .option("--dry-run", "Match only; do not create playlist", false)
  .option(
    "--include-ambiguous",
    "Add best guess when match is uncertain",
    false
  )
  .action(async (opts) => {
    const rows = parseTrackCsv(opts.file);
    console.log(`Loaded ${rows.length} rows from ${opts.file}`);

    await applyCreatePlan(
      {
        action: "create",
        playlist: {
          name: opts.name,
          description:
            opts.description ?? `Created by playlist-builder from ${opts.file}`,
          public: opts.public,
        },
        _rows: rows,
        tracks: rows.map((r) => ({ artist: r.artist, title: r.title })),
      },
      opts
    );
  });

program
  .command("edit")
  .description("Update an existing playlist from a CSV")
  .requiredOption("-p, --playlist <id|url>", "Playlist ID or Spotify URL")
  .requiredOption("-f, --file <path>", "CSV file path")
  .option(
    "-m, --mode <mode>",
    "sync: replace tracks to match CSV; add: append new tracks only",
    "sync"
  )
  .option("-n, --name <name>", "Rename the playlist")
  .option("-d, --description <text>", "Update playlist description")
  .option("--public", "Make playlist public")
  .option("--private", "Make playlist private")
  .option("--dry-run", "Match only; do not change playlist", false)
  .option(
    "--include-ambiguous",
    "Add best guess when match is uncertain",
    false
  )
  .action(async (opts) => {
    const playlistId = parsePlaylistId(opts.playlist);
    const playlist = await getPlaylist(playlistId);
    console.log(`Playlist: ${playlist.name}`);

    if (opts.public && opts.private) {
      throw new Error("Use only one of --public or --private");
    }

    const visibility =
      opts.public ? true : opts.private ? false : undefined;

    if (opts.name || opts.description !== undefined || visibility !== undefined) {
      if (!opts.dryRun) {
        await updatePlaylist(playlistId, {
          name: opts.name,
          description: opts.description,
          public: visibility,
        });
        const parts = [];
        if (opts.name) parts.push(`name → "${opts.name}"`);
        if (opts.description !== undefined) parts.push("description updated");
        if (visibility !== undefined)
          parts.push(visibility ? "public" : "private");
        console.log(`Updated playlist: ${parts.join(", ")}\n`);
      } else {
        console.log("(dry run) Would update playlist metadata\n");
      }
    }

    const rows = parseTrackCsv(opts.file);
    console.log(`Loaded ${rows.length} rows from ${opts.file}`);

    await applyEditPlan(
      {
        action: "edit",
        playlist: {
          url: opts.playlist,
          mode: opts.mode,
        },
        _rows: rows,
        tracks: rows.map((r) => ({ artist: r.artist, title: r.title })),
      },
      opts
    );
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
