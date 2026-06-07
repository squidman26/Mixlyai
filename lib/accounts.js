import {
  checkSupabaseAccountsTable,
  checkSupabaseCreditSchema,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "./supabase.js";
import { isUnlimitedAccount, recordInitialAccountCredits } from "./credits.js";

function mapSpotifyProfile(user) {
  return {
    spotify_id: user.id,
    display_name: user.display_name ?? null,
    email: user.email ?? null,
    avatar_url: user.images?.[0]?.url ?? null,
    product: user.product ?? null,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapNewAccount(user) {
  const unlimited = isUnlimitedAccount(user, null);

  return {
    ...mapSpotifyProfile(user),
    credits: 100,
    tier: "free",
    unlimited_credits: unlimited,
  };
}

const ACCOUNT_COLUMNS =
  "id, spotify_id, username, display_name, email, avatar_url, product, credits, tier, unlimited_credits, last_login_at, updated_at";

function mapAppAccount({ email, username, passwordHash, displayName }) {
  return {
    email,
    username,
    password_hash: passwordHash,
    display_name: displayName ?? username,
    credits: 100,
    tier: "free",
    unlimited_credits: false,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function createAccountFromSignup({ email, username, passwordHash, displayName }) {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase server key is not configured. Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  const tableCheck = await checkSupabaseCreditSchema();
  if (!tableCheck.ok) {
    const fallback = await checkSupabaseAccountsTable();
    throw new Error(tableCheck.error || fallback.error);
  }

  const supabase = getSupabaseAdmin();
  const { data: inserted, error } = await supabase
    .from("accounts")
    .insert(mapAppAccount({ email, username, passwordHash, displayName }))
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to create account: ${error.message}`);
  }

  try {
    await recordInitialAccountCredits(inserted);
  } catch (err) {
    console.error("Initial credit ledger sync failed:", err.message);
  }

  return inserted;
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

export async function getAccountByUsername(username) {
  if (!isSupabaseConfigured() || !username) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select(`${ACCOUNT_COLUMNS}, password_hash`)
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  return data;
}

export async function getAccountByEmail(email) {
  if (!isSupabaseConfigured() || !email) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select(`${ACCOUNT_COLUMNS}, password_hash`)
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  return data;
}

export async function upsertAccountFromSpotifyUser(user) {
  if (!user?.id) return null;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase server key is not configured. Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  const tableCheck = await checkSupabaseCreditSchema();
  if (!tableCheck.ok) {
    const fallback = await checkSupabaseAccountsTable();
    throw new Error(tableCheck.error || fallback.error);
  }

  const supabase = getSupabaseAdmin();
  const profile = mapSpotifyProfile(user);

  const { data: updated, error: updateError } = await supabase
    .from("accounts")
    .update({
      ...profile,
      ...(isUnlimitedAccount(user, null) ? { unlimited_credits: true } : {}),
    })
    .eq("spotify_id", user.id)
    .select(ACCOUNT_COLUMNS)
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to update account: ${updateError.message}`);
  }

  if (updated) return updated;

  const { data: inserted, error: insertError } = await supabase
    .from("accounts")
    .insert(mapNewAccount(user))
    .select(ACCOUNT_COLUMNS)
    .single();

  if (insertError) {
    throw new Error(`Failed to create account: ${insertError.message}`);
  }

  try {
    await recordInitialAccountCredits(inserted);
  } catch (err) {
    console.error("Initial credit ledger sync failed:", err.message);
  }

  return inserted;
}

export async function getAccountBySpotifyId(spotifyId) {
  if (!isSupabaseConfigured() || !spotifyId) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("spotify_id", spotifyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  return data;
}

export async function saveGeneratedPlaylist(accountId, playlist, trackCount) {
  if (!isSupabaseConfigured() || !accountId || !playlist?.id) return;

  const supabase = getSupabaseAdmin();
  const payload = {
    account_id: accountId,
    spotify_playlist_id: playlist.id,
    name: playlist.name,
    url: playlist.external_urls?.spotify ?? playlist.url ?? null,
    track_count: trackCount ?? playlist.tracks?.total ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("generated_playlists")
    .upsert(payload, { onConflict: "account_id,spotify_playlist_id" });

  if (error) {
    throw new Error(`Failed to save playlist: ${error.message}`);
  }
}

export async function listGeneratedPlaylists(accountId) {
  if (!isSupabaseConfigured() || !accountId) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("generated_playlists")
    .select("spotify_playlist_id, name, url, track_count, updated_at")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load playlists: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.spotify_playlist_id,
    name: row.name,
    url: row.url,
    tracks: row.track_count,
  }));
}
