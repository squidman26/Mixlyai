#!/usr/bin/env node
/**
 * Add or update a Vercel environment variable.
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/add-vercel-env.mjs SUPABASE_SECRET_KEY sb_secret_...
 *   VERCEL_TOKEN=... VERCEL_PROJECT_ID=prj_... node scripts/add-vercel-env.mjs KEY VALUE
 */

import { findProject, listProjects, upsertEnvVar } from "./vercel-api.mjs";

const [key, value] = process.argv.slice(2);
const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined;

if (!key || !value) {
  console.error("Usage: VERCEL_TOKEN=... node scripts/add-vercel-env.mjs KEY VALUE");
  process.exit(1);
}

async function getProjectId() {
  if (process.env.VERCEL_PROJECT_ID) return process.env.VERCEL_PROJECT_ID;

  const projects = await listProjects("mixlyai");
  const project = findProject(projects, ["mixlyai", "mixly", "spotifybot", "spotifybot-eight"]);
  if (!project?.id) {
    throw new Error("Could not find Vercel project. Set VERCEL_PROJECT_ID or run migrate-vercel-to-mixlyai.mjs first.");
  }
  return project.id;
}

async function main() {
  const id = await getProjectId();
  await upsertEnvVar(id, { key, value }, teamId);
  console.log(`Set Vercel env ${key} on project ${id}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
