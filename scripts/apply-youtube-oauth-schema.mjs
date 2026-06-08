#!/usr/bin/env node
/**
 * Add OAuth token columns to account_connections (required for YouTube connect).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-youtube-oauth-schema.mjs
 *
 * Or paste supabase/migrations/20250608000000_youtube_connection_tokens.sql
 * into Supabase Dashboard → SQL Editor → Run.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROJECT_REF = "npkmlflciakpzkskkqvy";

async function runQuery(token, sql) {
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
      `Schema push failed (${res.status}): ${body.message || JSON.stringify(body)}`
    );
  }

  return body;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN.");
    console.error("Create one at https://supabase.com/dashboard/account/tokens");
    console.error(
      "Then run: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-youtube-oauth-schema.mjs"
    );
    process.exitCode = 1;
    return;
  }

  const sql = readFileSync(
    join(ROOT, "supabase/migrations/20250608000000_youtube_connection_tokens.sql"),
    "utf8"
  );

  console.log("Applying YouTube OAuth token columns...");
  await runQuery(token, sql);
  console.log("Done. YouTube connect should work now.");
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
