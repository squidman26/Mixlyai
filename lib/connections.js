import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";
import {
  exchangeRefreshToken,
  isSoundCloudConfigured,
  normalizeTokenBundle,
  signOut,
} from "./soundcloud.js";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const MUSIC_PROVIDERS = [
  {
    id: "spotify",
    name: "Spotify",
    description: "Apply playlists directly to your Spotify library.",
    icon: "🎵",
    available: false,
  },
  {
    id: "youtube",
    name: "YouTube Music",
    description: "Match tracks and sync playlists on YouTube Music.",
    icon: "▶️",
    available: false,
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    description: "Match tracks and create playlists on your SoundCloud account.",
    icon: "☁️",
    available: false,
  },
];

function isProviderAvailable(providerId) {
  if (providerId === "soundcloud") return isSoundCloudConfigured();
  return MUSIC_PROVIDERS.find((provider) => provider.id === providerId)?.available;
}

function isTokenFresh(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS;
}

export async function listAccountConnections(accountId) {
  if (!isSupabaseConfigured() || !accountId) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("account_connections")
    .select("provider, external_id, display_name, connected_at, updated_at")
    .eq("account_id", accountId);

  if (error?.code === "PGRST205") {
    return [];
  }

  if (error) {
    throw new Error(`Failed to load connections: ${error.message}`);
  }

  return data ?? [];
}

async function getConnectionWithTokens(accountId, provider) {
  if (!isSupabaseConfigured() || !accountId || !provider) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("account_connections")
    .select(
      "provider, external_id, display_name, access_token, refresh_token, token_expires_at, scope"
    )
    .eq("account_id", accountId)
    .eq("provider", provider)
    .maybeSingle();

  if (error?.code === "PGRST205") return null;
  if (error) {
    throw new Error(`Failed to load ${provider} connection: ${error.message}`);
  }

  return data;
}

export async function upsertSoundCloudConnection(accountId, { profile, tokens }) {
  if (!isSupabaseConfigured() || !accountId) {
    throw new Error("Database is not configured");
  }

  const bundle = normalizeTokenBundle(tokens);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("account_connections").upsert(
    {
      account_id: accountId,
      provider: "soundcloud",
      external_id: profile?.id != null ? String(profile.id) : null,
      display_name: profile?.username || profile?.permalink || null,
      access_token: bundle.accessToken,
      refresh_token: bundle.refreshToken,
      token_expires_at: bundle.expiresAt,
      scope: bundle.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id,provider" }
  );

  if (error) {
    throw new Error(`Failed to save SoundCloud connection: ${error.message}`);
  }
}

async function saveConnectionTokens(accountId, provider, tokens) {
  const bundle = normalizeTokenBundle(tokens);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("account_connections")
    .update({
      access_token: bundle.accessToken,
      refresh_token: bundle.refreshToken,
      token_expires_at: bundle.expiresAt,
      scope: bundle.scope,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId)
    .eq("provider", provider);

  if (error) {
    throw new Error(`Failed to update ${provider} tokens: ${error.message}`);
  }

  return bundle.accessToken;
}

export async function getSoundCloudAccessToken(accountId) {
  const connection = await getConnectionWithTokens(accountId, "soundcloud");
  if (!connection?.access_token) {
    throw new Error("SoundCloud is not connected for this account");
  }

  if (isTokenFresh(connection.token_expires_at)) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    throw new Error("SoundCloud session expired. Reconnect your account.");
  }

  const tokens = await exchangeRefreshToken(connection.refresh_token);
  return saveConnectionTokens(accountId, "soundcloud", tokens);
}

export async function disconnectAccountConnection(accountId, provider) {
  if (!isSupabaseConfigured() || !accountId || !provider) return;

  if (provider === "soundcloud") {
    const connection = await getConnectionWithTokens(accountId, provider);
    if (connection?.access_token) {
      await signOut(connection.access_token);
    }
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("account_connections")
    .delete()
    .eq("account_id", accountId)
    .eq("provider", provider);

  if (error?.code === "PGRST205") return;

  if (error) {
    throw new Error(`Failed to disconnect ${provider}: ${error.message}`);
  }
}

export function buildConnectionsResponse(connections) {
  const linked = new Map(connections.map((row) => [row.provider, row]));

  return MUSIC_PROVIDERS.map((provider) => {
    const row = linked.get(provider.id);
    return {
      provider: provider.id,
      name: provider.name,
      description: provider.description,
      icon: provider.icon,
      available: isProviderAvailable(provider.id),
      connected: Boolean(row),
      displayName: row?.display_name ?? null,
      connectedAt: row?.connected_at ?? null,
    };
  });
}
