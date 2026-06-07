import crypto from "crypto";
import {
  checkSupabaseAuthSchema,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "./supabase.js";
import { recordInitialAccountCredits } from "./credits.js";
import { hashPassword, verifyPassword } from "./password.js";

const APP_PROVIDER = "app";

const ACCOUNT_COLUMNS =
  "id, provider, external_id, username, display_name, email, credits, tier, unlimited_credits, last_login_at, updated_at";

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function createAppAccount({ email, username, password }) {
  if (!email?.trim() || !username?.trim() || !password) {
    throw new Error("Email, username, and password are required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase server key is not configured. Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  const tableCheck = await checkSupabaseAuthSchema();
  if (!tableCheck.ok) {
    throw new Error(tableCheck.error);
  }

  const supabase = getSupabaseAdmin();
  const passwordHash = await hashPassword(password);
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  const { data: inserted, error: insertError } = await supabase
    .from("accounts")
    .insert({
      provider: APP_PROVIDER,
      external_id: normalizedUsername,
      email: normalizedEmail,
      username: normalizedUsername,
      display_name: username.trim(),
      password_hash: passwordHash,
      credits: 100,
      tier: "free",
      unlimited_credits: false,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(ACCOUNT_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("Email or username is already taken");
    }
    if (/password_hash|schema cache/i.test(insertError.message ?? "")) {
      throw new Error(
        "Database auth columns are missing. Run supabase/migrations/20250607170000_fix_auth_columns.sql in the Supabase SQL editor."
      );
    }
    if (/external_id/i.test(insertError.message ?? "")) {
      throw new Error(
        "Account schema mismatch. Run supabase/migrations/20250607180000_app_external_id.sql in the Supabase SQL editor."
      );
    }
    throw new Error(`Failed to create account: ${insertError.message}`);
  }

  try {
    await recordInitialAccountCredits(inserted);
  } catch (err) {
    console.error("Initial credit ledger sync failed:", err.message);
  }

  return inserted;
}

export async function authenticateAppAccount({ login, password }) {
  if (!login?.trim() || !password) return null;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase server key is not configured. Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  const tableCheck = await checkSupabaseAuthSchema();
  if (!tableCheck.ok) {
    throw new Error(tableCheck.error);
  }

  const supabase = getSupabaseAdmin();
  const normalized = login.trim().toLowerCase();
  const column = normalized.includes("@") ? "email" : "username";

  const { data: account, error } = await supabase
    .from("accounts")
    .select(`${ACCOUNT_COLUMNS}, password_hash`)
    .eq(column, normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  if (!account?.password_hash) return null;

  const valid = await verifyPassword(password, account.password_hash);
  if (!valid) return null;

  const { data: updated, error: updateError } = await supabase
    .from("accounts")
    .update({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id)
    .select(ACCOUNT_COLUMNS)
    .single();

  if (updateError) {
    throw new Error(`Failed to update account: ${updateError.message}`);
  }

  return updated;
}

export async function getAccountById(accountId) {
  if (!isSupabaseConfigured() || !accountId) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  return data;
}

export async function savePlaylist(accountId, plan) {
  if (!isSupabaseConfigured() || !accountId || !plan?.playlist?.name) return null;

  const supabase = getSupabaseAdmin();
  const slug = crypto.randomUUID();
  const trackCount = plan.tracks?.length ?? 0;

  const payload = {
    account_id: accountId,
    playlist_slug: slug,
    name: plan.playlist.name,
    description: plan.playlist.description ?? null,
    tracks_json: plan.tracks ?? [],
    track_count: trackCount,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("saved_playlists")
    .insert(payload)
    .select("playlist_slug, name, description, track_count, tracks_json, updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to save playlist: ${error.message}`);
  }

  return data;
}

export async function listSavedPlaylists(accountId) {
  if (!isSupabaseConfigured() || !accountId) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("saved_playlists")
    .select("playlist_slug, name, description, track_count, tracks_json, updated_at")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load playlists: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.playlist_slug,
    name: row.name,
    description: row.description,
    tracks: row.track_count,
    tracksJson: row.tracks_json,
    updatedAt: row.updated_at,
  }));
}
