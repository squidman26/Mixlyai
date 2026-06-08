import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";
import { isYoutubeOAuthConfigured, tokenExpiresAt } from "./google-auth.js";

export const MUSIC_PROVIDERS = [
  {
    id: "youtube",
    name: "YouTube",
    description: "Match tracks and create playlists on your YouTube account.",
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
