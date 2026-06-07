import {
  checkSupabaseAccountsTable,
  checkSupabaseCreditSchema,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "./supabase.js";
import { isUnlimitedAccount, recordInitialAccountCredits } from "./credits.js";
import { hashPassword, verifyPassword } from "./password.js";

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
  "id, spotify_id, username, display_name, email, avatar_url, product, credits, tier, unlimited_credits, spotify_refresh_token, spotify_access_token, spotify_token_expires_at, last_login_at, updated_at";

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

  const tableCheck = await checkSupabaseCreditSchema();
  if (!tableCheck.ok) {
    const fallback = await checkSupabaseAccountsTable();
    throw new Error(tableCheck.error || fallback.error);
  }

  const supabase = getSupabaseAdmin();
  const passwordHash = await hashPassword(password);
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  const { data: inserted, error: insertError } = await supabase
    .from("accounts")
    .insert({
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

  const supabase = getSupabaseAdmin();
  const normalized = login.trim().toLowerCase();
  const column = normalized.includes("@") ? "email" : "username";

  const { data: account, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
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

export async function linkSpotifyToAccount(accountId, spotifySession, spotifyUser) {
  if (!accountId || !spotifySession?.refresh_token) {
    throw new Error("Spotify session is required");
  }

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase server key is not configured. Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  const supabase = getSupabaseAdmin();
  const profile = spotifyUser ? mapSpotifyProfile(spotifyUser) : {};

  const { data: updated, error } = await supabase
    .from("accounts")
    .update({
      ...profile,
      spotify_refresh_token: spotifySession.refresh_token,
      spotify_access_token: spotifySession.access_token ?? null,
      spotify_token_expires_at: spotifySession.expires_at
        ? new Date(spotifySession.expires_at).toISOString()
        : null,
      ...(spotifyUser && isUnlimitedAccount(spotifyUser, null)
        ? { unlimited_credits: true }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This Spotify account is already linked to another user");
    }
    throw new Error(`Failed to link Spotify: ${error.message}`);
  }

  return updated;
}

export async function clearSpotifyConnection(accountId) {
  if (!isSupabaseConfigured() || !accountId) return;

  const account = await getAccountById(accountId);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("accounts")
    .update({
      spotify_id: null,
      spotify_refresh_token: null,
      spotify_access_token: null,
      spotify_token_expires_at: null,
      avatar_url: null,
      product: null,
      display_name: account?.username ?? account?.display_name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    throw new Error(`Failed to disconnect Spotify: ${error.message}`);
  }
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
