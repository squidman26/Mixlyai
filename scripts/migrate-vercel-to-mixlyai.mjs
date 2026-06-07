#!/usr/bin/env node
/**
 * Migrate the old Spotifybot/Mixly Vercel project to MixlyAI.
 *
 * Default (recommended): rename the existing project to preserve env vars,
 * GitHub link, and deployment history.
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/migrate-vercel-to-mixlyai.mjs
 *   VERCEL_TOKEN=... node scripts/migrate-vercel-to-mixlyai.mjs --recreate --delete-old
 *   VERCEL_TOKEN=... VERCEL_TEAM_ID=team_... node scripts/migrate-vercel-to-mixlyai.mjs
 *
 * Options:
 *   --old-name <name>     Old project name (default: spotifybot)
 *   --new-name <name>     New project name (default: mixlyai)
 *   --base-url <url>      Production URL to set in env (default: https://mixlyai.vercel.app)
 *   --recreate            Create a fresh project instead of renaming
 *   --delete-old          Delete the old project after recreate (requires --recreate)
 *   --dry-run             Print actions without making changes
 */

import {
  createProject,
  deleteProject,
  findProject,
  listEnvVars,
  listProjects,
  projectUrl,
  renameProject,
  upsertEnvVar,
} from "./vercel-api.mjs";

function parseArgs(argv) {
  const opts = {
    oldName: "spotifybot",
    newName: "mixlyai",
    baseUrl: "https://mixlyai.vercel.app",
    recreate: false,
    deleteOld: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--recreate") opts.recreate = true;
    else if (arg === "--delete-old") opts.deleteOld = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--old-name") opts.oldName = argv[++i];
    else if (arg === "--new-name") opts.newName = argv[++i];
    else if (arg === "--base-url") opts.baseUrl = argv[++i]?.replace(/\/$/, "");
  }

  return opts;
}

const LEGACY_NAMES = [
  "spotifybot",
  "spotifybot-eight",
  "mixly",
  "playlist-builder",
  "playlistmaker",
];

const LEGACY_ENV_KEYS = [
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_REDIRECT_URI",
  "UNLIMITED_CREDITS_SPOTIFY_IDS",
];

async function updateMixlyAiEnv(projectIdOrName, baseUrl, teamId, dryRun) {
  const updates = [
    ["APP_BASE_URL", baseUrl],
    ["OAUTH_REDIRECT_URI", `${baseUrl}/api/auth/callback`],
  ];

  for (const [key, value] of updates) {
    console.log(`  env ${key}=${value}`);
    if (!dryRun) {
      await upsertEnvVar(projectIdOrName, { key, value }, teamId);
    }
  }

  for (const key of LEGACY_ENV_KEYS) {
    console.log(`  remove legacy env ${key} (manual cleanup in dashboard if still present)`);
  }
}

async function copyEnvVars(fromProject, toProject, teamId, dryRun) {
  const envs = await listEnvVars(fromProject.id, teamId);
  let copied = 0;
  let skipped = 0;

  for (const env of envs) {
    if (LEGACY_ENV_KEYS.includes(env.key)) {
      skipped++;
      continue;
    }

    if (!env.value) {
      console.log(`  skip ${env.key} (encrypted — re-add manually in Vercel dashboard)`);
      skipped++;
      continue;
    }

    console.log(`  copy ${env.key}`);
    if (!dryRun) {
      await upsertEnvVar(
        toProject.id,
        {
          key: env.key,
          value: env.value,
          type: env.type,
          targets: env.target,
        },
        teamId
      );
    }
    copied++;
  }

  return { copied, skipped };
}

async function renameFlow(opts, teamId) {
  const projects = await listProjects(opts.oldName);
  const oldProject = findProject(projects, [
    opts.oldName,
    ...LEGACY_NAMES,
  ]);

  if (!oldProject) {
    throw new Error(
      `Could not find old Vercel project matching "${opts.oldName}". Set --old-name or create the MixlyAI project manually.`
    );
  }

  console.log(`Found project: ${oldProject.name} (${oldProject.id})`);
  console.log(`Current URL: ${projectUrl(oldProject) ?? "(unknown)"}`);

  if (oldProject.name === opts.newName) {
    console.log(`Project is already named "${opts.newName}". Updating env only.`);
  } else {
    console.log(`Renaming ${oldProject.name} → ${opts.newName}`);
    if (!opts.dryRun) {
      await renameProject(oldProject.id, opts.newName, teamId);
    }
  }

  console.log("Updating MixlyAI environment variables:");
  await updateMixlyAiEnv(opts.newName, opts.baseUrl, teamId, opts.dryRun);

  console.log("\nDone.");
  console.log(`Production URL: ${opts.baseUrl}`);
  console.log("Next steps:");
  console.log("  1. Merge and push to main — Vercel will auto-deploy");
  console.log("  2. Update OAuth redirect URIs in Google Cloud + SoundCloud to:");
  console.log(`     ${opts.baseUrl}/api/auth/callback`);
  console.log("  3. Remove legacy SPOTIFY_* env vars in Vercel dashboard");
  console.log("  4. Add YOUTUBE_* and SOUNDCLOUD_* env vars if not already set");
}

async function recreateFlow(opts, teamId) {
  const projects = await listProjects();
  const oldProject = findProject(projects, [opts.oldName, ...LEGACY_NAMES]);
  const existingNew = findProject(projects, [opts.newName]);

  if (existingNew && !opts.dryRun) {
    throw new Error(
      `Project "${opts.newName}" already exists (${existingNew.id}). Use rename mode or delete it first.`
    );
  }

  console.log("Creating fresh Vercel project:", opts.newName);
  let newProject = { id: opts.newName, name: opts.newName };

  if (!opts.dryRun) {
    const gitRepo = process.env.GITHUB_REPO || "squidman26/MixlyAI";
    newProject = await createProject(opts.newName, { teamId, gitRepo });
  }

  if (oldProject) {
    console.log(`Copying env vars from ${oldProject.name}...`);
    const { copied, skipped } = await copyEnvVars(
      oldProject,
      newProject,
      teamId,
      opts.dryRun
    );
    console.log(`Copied ${copied}, skipped ${skipped}`);
  }

  console.log("Setting MixlyAI environment variables:");
  await updateMixlyAiEnv(newProject.id ?? opts.newName, opts.baseUrl, teamId, opts.dryRun);

  if (opts.deleteOld && oldProject) {
    console.log(`Deleting old project: ${oldProject.name}`);
    if (!opts.dryRun) {
      await deleteProject(oldProject.id, teamId);
    }
  }

  console.log("\nDone.");
  console.log(`Production URL: ${opts.baseUrl}`);
  console.log("Next steps:");
  console.log("  1. Connect GitHub repo in Vercel if not auto-linked");
  console.log("  2. Re-add any encrypted env vars that could not be copied");
  console.log("  3. Push to main to deploy");
  console.log("  4. Update OAuth redirect URIs to:");
  console.log(`     ${opts.baseUrl}/api/auth/callback`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined;

  console.log("=== MixlyAI Vercel migration ===\n");
  if (opts.dryRun) console.log("(dry run — no changes will be made)\n");

  if (opts.recreate) {
    await recreateFlow(opts, teamId);
  } else {
    await renameFlow(opts, teamId);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
