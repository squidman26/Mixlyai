#!/usr/bin/env node
/**
 * Apply Mixly auth schema to Supabase.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-auth-schema.mjs
 *
 * Get a token: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROJECT_REF = "npkmlflciakpzkskkqvy";

const MIGRATIONS = [
  "20250607170000_fix_auth_columns.sql",
  "20250607180000_app_external_id.sql",
  "20250607190000_account_connections.sql",
  "20250607200000_remove_spotify_provider.sql",
];

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
    console.error("Then run: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-auth-schema.mjs");
    process.exitCode = 1;
    return;
  }

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(ROOT, "supabase/migrations", file), "utf8");
    console.log(`Applying ${file}...`);
    await runQuery(token, sql);
    console.log(`Applied ${file}`);
  }

  console.log("Auth schema is ready. Sign-up should work now.");
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
