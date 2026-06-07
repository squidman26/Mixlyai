import { createClient } from "@supabase/supabase-js";

let adminClient = null;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getServiceRoleKey());
}

export function getSupabaseConfigError() {
  if (!getSupabaseUrl()) {
    return "Missing NEXT_PUBLIC_SUPABASE_URL";
  }
  if (!getServiceRoleKey()) {
    return "Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY";
  }
  return null;
}

export function getSupabaseAdmin() {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(`Supabase is not configured. ${configError}`);
  }

  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

export async function checkSupabaseAccountsTable() {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: getSupabaseConfigError() };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("accounts").select("id").limit(1);

  if (error?.code === "PGRST205") {
    return {
      ok: false,
      error:
        "accounts table is missing. Run supabase/migrations/20250606120000_create_accounts.sql in the Supabase SQL editor.",
    };
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function checkSupabaseCreditSchema() {
  const accountsCheck = await checkSupabaseAccountsTable();
  if (!accountsCheck.ok) return accountsCheck;

  const supabase = getSupabaseAdmin();
  const checks = [
    {
      table: "accounts",
      columns: "credits, tier, unlimited_credits",
      migration: "20250607120000_add_credit_system.sql",
    },
    {
      table: "credit_purchases",
      columns: "id, account_id, tier, status",
      migration: "20250607120000_add_credit_system.sql",
    },
    {
      table: "credit_transactions",
      columns: "id, account_id, amount, reason",
      migration: "20250607130000_credit_transactions.sql",
    },
  ];

  for (const check of checks) {
    const { error } = await supabase.from(check.table).select(check.columns).limit(1);

    if (error?.code === "PGRST205") {
      return {
        ok: false,
        error: `${check.table} table is missing. Run supabase/migrations/${check.migration} in the Supabase SQL editor.`,
      };
    }

    if (error?.code === "42703") {
      return {
        ok: false,
        error: `${check.table} is missing credit columns. Run supabase/migrations/${check.migration} in the Supabase SQL editor.`,
      };
    }

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export async function checkSupabaseAuthSchema() {
  const creditsCheck = await checkSupabaseCreditSchema();
  if (!creditsCheck.ok) return creditsCheck;

  const supabase = getSupabaseAdmin();
  const checks = [
    {
      columns: "username, password_hash, provider, external_id",
      migration: "20250607180000_app_external_id.sql",
      label: "app auth columns",
    },
    {
      table: "saved_playlists",
      columns: "playlist_slug, name, tracks_json",
      migration: "20250607160000_remove_spotify.sql",
      label: "saved_playlists table",
    },
  ];

  for (const check of checks) {
    const table = check.table ?? "accounts";
    const { error } = await supabase.from(table).select(check.columns).limit(1);

    if (error?.code === "PGRST205") {
      return {
        ok: false,
        error: `${check.label} is missing. Run supabase/migrations/${check.migration} in the Supabase SQL editor: https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql`,
      };
    }

    if (error?.code === "42703" || /schema cache/i.test(error?.message ?? "")) {
      return {
        ok: false,
        error: `Database is missing ${check.label}. Run supabase/migrations/${check.migration} in the Supabase SQL editor: https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql`,
      };
    }

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}
