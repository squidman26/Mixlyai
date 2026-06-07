import {
  checkSupabaseAccountsTable,
  checkSupabaseCreditSchema,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "./supabase.js";
import { isUnlimitedAccount, recordInitialAccountCredits } from "./credits.js";

function mapProviderProfile(user) {
  return {
    provider: user.provider,
    external_id: user.id,
    display_name: user.display_name ?? null,
    email: user.email ?? null,
    avatar_url: user.avatar_url ?? null,
    product: user.product ?? null,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapNewAccount(user) {
  const unlimited = isUnlimitedAccount(user, null);

  return {
    ...mapProviderProfile(user),
    credits: 100,
    tier: "free",
    unlimited_credits: unlimited,
  };
}

const ACCOUNT_COLUMNS =
  "id, provider, external_id, display_name, email, avatar_url, product, credits, tier, unlimited_credits, last_login_at, updated_at";

export async function upsertAccountFromProviderUser(user) {
  if (!user?.id || !user?.provider) return null;

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
  const profile = mapProviderProfile(user);

  const { data: updated, error: updateError } = await supabase
    .from("accounts")
    .update({
      ...profile,
      ...(isUnlimitedAccount(user, null) ? { unlimited_credits: true } : {}),
    })
    .eq("provider", user.provider)
    .eq("external_id", user.id)
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

export async function getAccountByExternalId(provider, externalId) {
  if (!isSupabaseConfigured() || !externalId) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("provider", provider)
    .eq("external_id", externalId)
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
    provider: playlist.provider,
    external_playlist_id: String(playlist.id),
    name: playlist.name,
    url:
      playlist.external_urls?.youtube ||
      playlist.external_urls?.soundcloud ||
      playlist.url ||
      null,
    track_count: trackCount ?? playlist.tracks?.total ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("generated_playlists")
    .upsert(payload, { onConflict: "account_id,provider,external_playlist_id" });

  if (error) {
    throw new Error(`Failed to save playlist: ${error.message}`);
  }
}

export async function listGeneratedPlaylists(accountId) {
  if (!isSupabaseConfigured() || !accountId) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("generated_playlists")
    .select(
      "provider, external_playlist_id, name, url, track_count, updated_at"
    )
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load playlists: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.external_playlist_id,
    provider: row.provider,
    name: row.name,
    url: row.url,
    tracks: row.track_count,
  }));
}
