#!/usr/bin/env node
/**
 * Check whether Spotify users have been saved to Supabase accounts.
 *
 * Usage:
 *   SUPABASE_SECRET_KEY=sb_secret_... node scripts/check-accounts.mjs
 *
 * Or against production Vercel health (no account list):
 *   node scripts/check-accounts.mjs --production
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://npkmlflciakpzkskkqvy.supabase.co";

const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRODUCTION_URL =
  process.env.APP_BASE_URL || "https://spotifybot-eight.vercel.app";

async function checkProductionHealth() {
  const res = await fetch(`${PRODUCTION_URL}/api/health/supabase`);
  const body = await res.json().catch(() => ({}));
  console.log("Production /api/health/supabase:");
  console.log(JSON.stringify(body, null, 2));
  return body;
}

async function listAccounts() {
  if (!SECRET_KEY) {
    console.error(
      "Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("accounts")
    .select("id, spotify_id, display_name, email, product, last_login_at")
    .order("last_login_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === "PGRST205") {
      console.error(
        "accounts table missing. Run supabase/setup.sql in the Supabase SQL editor."
      );
    } else {
      console.error("Query failed:", error.message);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nAccounts logged in: ${data.length}`);
  if (data.length === 0) {
    console.log("No Spotify logins recorded yet.");
    return;
  }

  for (const row of data) {
    console.log(
      `- ${row.display_name || "Unknown"} (${row.spotify_id}) last_login=${row.last_login_at}`
    );
  }
}

async function main() {
  const productionOnly = process.argv.includes("--production");

  console.log("=== Vercel + Supabase integration check ===\n");
  const health = await checkProductionHealth();

  if (productionOnly || !SECRET_KEY) {
    if (!health.ok) {
      process.exitCode = 1;
    }
    return;
  }

  await listAccounts();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
