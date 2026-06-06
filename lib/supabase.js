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
