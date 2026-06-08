import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";
import { isYoutubeOAuthConfigured, tokenExpiresAt } from "./google-auth.js";
import { isTokenFresh, refreshGoogleAccessToken } from "./youtube.js";

export const MUSIC_PROVIDERS = [
  {
    id: "youtube",
    name: "YouTube",
    description: "Match songs and videos, then create playlists on your YouTube account.",
    icon: "▶️",
    available: false,
  },
];

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

export async function upsertYoutubeConnection(accountId, tokens) {
  if (!isSupabaseConfigured() || !accountId) {
    throw new Error("Database is not configured");
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("account_connections").upsert(
    {
      account_id: accountId,
      provider: "youtube",
      external_id: tokens.externalId ?? null,
      display_name: tokens.displayName ?? null,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? null,
      token_expires_at: tokenExpiresAt(tokens.expiresIn),
      scope: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id,provider" }
  );

  if (error) {
    throw new Error(`Failed to save YouTube connection: ${error.message}`);
  }
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

async function saveConnectionTokens(accountId, provider, tokens, existingRefreshToken) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("account_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? existingRefreshToken ?? null,
      token_expires_at: tokenExpiresAt(tokens.expires_in),
      scope: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId)
    .eq("provider", provider);

  if (error) {
    throw new Error(`Failed to update ${provider} tokens: ${error.message}`);
  }

  return tokens.access_token;
}

export async function getYoutubeAccessToken(accountId) {
  const connection = await getConnectionWithTokens(accountId, "youtube");
  if (!connection?.access_token) {
    throw new Error("YouTube is not connected for this account");
  }

  if (isTokenFresh(connection.token_expires_at)) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    throw new Error("YouTube session expired. Reconnect your account.");
  }

  const tokens = await refreshGoogleAccessToken(connection.refresh_token);
  return saveConnectionTokens(
    accountId,
    "youtube",
    tokens,
    connection.refresh_token
  );
}

export async function disconnectAccountConnection(accountId, provider) {
  if (!isSupabaseConfigured() || !accountId || !provider) return;

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
    const available =
      provider.id === "youtube" ? isYoutubeOAuthConfigured() : provider.available;
    return {
      provider: provider.id,
      name: provider.name,
      description: provider.description,
      icon: provider.icon,
      available,
      connected: Boolean(row),
      displayName: row?.display_name ?? null,
      connectedAt: row?.connected_at ?? null,
    };
  });
}
