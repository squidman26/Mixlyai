import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";

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
    description: "Discover and save tracks from SoundCloud.",
    icon: "☁️",
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
    return {
      provider: provider.id,
      name: provider.name,
      description: provider.description,
      icon: provider.icon,
      available: provider.available,
      connected: Boolean(row),
      displayName: row?.display_name ?? null,
      connectedAt: row?.connected_at ?? null,
    };
  });
}
