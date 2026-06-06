#!/usr/bin/env node
/**
 * Push Supabase schema and Vercel env vars when credentials are available.
 *
 * Required for Supabase migration:
 *   SUPABASE_ACCESS_TOKEN  — from https://supabase.com/dashboard/account/tokens
 *
 * Required for Vercel env:
 *   VERCEL_TOKEN           — from https://vercel.com/account/tokens
 *   VERCEL_PROJECT_ID      — optional; auto-detected when linked
 *
 * Also set locally before running:
 *   SUPABASE_SERVICE_ROLE_KEY — from Supabase project Settings → API
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROJECT_REF = "npkmlflciakpzkskkqvy";

const SUPABASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://npkmlflciakpzkskkqvy.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_EaBzw2QLLLKj-IgvwDX9WA_JEN-PggR",
};

async function pushSupabaseSchema() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.log("Skip schema: SUPABASE_ACCESS_TOKEN not set");
    return false;
  }

  const sql = readFileSync(join(ROOT, "supabase/setup.sql"), "utf8");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Supabase schema push failed (${res.status}): ${body.message || JSON.stringify(body)}`
    );
  }

  console.log("Supabase accounts schema applied");
  return true;
}

async function getVercelProjectId(token) {
  if (process.env.VERCEL_PROJECT_ID) return process.env.VERCEL_PROJECT_ID;

  const res = await fetch("https://api.vercel.com/v9/projects?search=spotifybot", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Vercel project lookup failed: ${JSON.stringify(body)}`);
  }

  const project = body.projects?.find((p) =>
    p.name?.includes("spotifybot")
  ) ?? body.projects?.[0];

  if (!project?.id) {
    throw new Error("Could not find Vercel project. Set VERCEL_PROJECT_ID.");
  }

  return project.id;
}

async function upsertVercelEnv(token, projectId, key, value) {
  const listRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const existing = await listRes.json();
  const found = existing.envs?.find((env) => env.key === key);

  const payload = {
    key,
    value,
    type: key.includes("SECRET") || key.includes("SERVICE_ROLE") ? "encrypted" : "plain",
    target: ["production", "preview", "development"],
  };

  const url = found
    ? `https://api.vercel.com/v9/projects/${projectId}/env/${found.id}`
    : `https://api.vercel.com/v10/projects/${projectId}/env`;

  const res = await fetch(url, {
    method: found ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Vercel env ${key} failed (${res.status}): ${body.error?.message || JSON.stringify(body)}`
    );
  }

  console.log(`Vercel env set: ${key}`);
}

async function pushVercelEnv() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.log("Skip Vercel env: VERCEL_TOKEN not set");
    return false;
  }

  const projectId = await getVercelProjectId(token);

  for (const [key, value] of Object.entries(SUPABASE_ENV)) {
    await upsertVercelEnv(token, projectId, key, value);
  }

  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secretKey) {
    await upsertVercelEnv(token, projectId, "SUPABASE_SECRET_KEY", secretKey);
  } else {
    console.log(
      "Note: SUPABASE_SECRET_KEY not set locally — add it in Vercel manually"
    );
  }

  return true;
}

async function main() {
  const schemaOk = await pushSupabaseSchema();
  const vercelOk = await pushVercelEnv();

  if (!schemaOk && !vercelOk) {
    console.log("\nNothing ran. Provide at least one of:");
    console.log("  SUPABASE_ACCESS_TOKEN  — push accounts schema");
    console.log("  VERCEL_TOKEN           — set Supabase env on Vercel");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
