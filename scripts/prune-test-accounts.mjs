#!/usr/bin/env node
/**
 * Delete all accounts except the one matching KEEP_NAME (default: Ayden).
 *
 * Usage:
 *   SUPABASE_SECRET_KEY=... node scripts/prune-test-accounts.mjs
 *   SUPABASE_SECRET_KEY=... node scripts/prune-test-accounts.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://npkmlflciakpzkskkqvy.supabase.co";

const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const KEEP_NAME = (process.env.KEEP_ACCOUNT_NAME || "Ayden").trim().toLowerCase();
const DRY_RUN = process.argv.includes("--dry-run");

function matchesKeepAccount(account) {
  const fields = [account.display_name, account.username]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  return fields.some((value) => value === KEEP_NAME);
}

async function main() {
  if (!SECRET_KEY) {
    console.error("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, username, display_name, email, tier, unlimited_credits");

  if (error) {
    console.error("Failed to list accounts:", error.message);
    process.exitCode = 1;
    return;
  }

  const keep = accounts.filter(matchesKeepAccount);
  const remove = accounts.filter((account) => !matchesKeepAccount(account));

  console.log(`Total accounts: ${accounts.length}`);
  console.log(`Keeping (${keep.length}):`);
  for (const account of keep) {
    console.log(
      `  - ${account.display_name || account.username || account.email} (@${account.username || "?"}) ${account.id}`
    );
  }

  console.log(`Removing (${remove.length}):`);
  for (const account of remove) {
    console.log(
      `  - ${account.display_name || account.username || account.email} (@${account.username || "?"}) ${account.id}`
    );
  }

  if (keep.length === 0) {
    console.error(`No account matched KEEP_ACCOUNT_NAME="${KEEP_NAME}". Aborting.`);
    process.exitCode = 1;
    return;
  }

  if (remove.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (DRY_RUN) {
    console.log("Dry run only — no rows deleted.");
    return;
  }

  const ids = remove.map((account) => account.id);
  const { error: deleteError } = await supabase.from("accounts").delete().in("id", ids);

  if (deleteError) {
    console.error("Delete failed:", deleteError.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Deleted ${ids.length} test account(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
