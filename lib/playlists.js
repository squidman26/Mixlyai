import { playlistUrl } from "./music.js";

export const PLAYLIST_MARKER = "Created with MixlyAI";

export function playlistDescription(meta = {}) {
  const custom = meta.description?.trim();
  if (!custom) return PLAYLIST_MARKER;
  if (custom.includes(PLAYLIST_MARKER)) return custom;
  return `${custom} · ${PLAYLIST_MARKER}`;
}

export function isGeneratedPlaylist(playlist) {
  const desc = (playlist.description || "").toLowerCase();
  return desc.includes("mixlyai") || desc.includes("mixly") || desc.includes("playlist builder");
}

export function recordGeneratedPlaylist(session, playlist, trackCount) {
  const entry = {
    id: playlist.id,
    provider: playlist.provider ?? session.provider,
    name: playlist.name,
    url: playlistUrl(playlist),
    tracks: trackCount ?? playlist.tracks?.total ?? 0,
  };

  const existing = session.generatedPlaylists ?? [];
  const filtered = existing.filter(
    (p) => !(p.id === entry.id && p.provider === entry.provider)
  );
  return {
    ...session,
    generatedPlaylists: [entry, ...filtered],
  };
}

export function mergeGeneratedPlaylists(sessionList, providerList) {
  const byKey = new Map();

  for (const p of sessionList ?? []) {
    if (p.id) byKey.set(`${p.provider}:${p.id}`, p);
  }

  for (const p of providerList.filter(isGeneratedPlaylist)) {
    const key = `${p.provider}:${p.id}`;
    byKey.set(key, {
      id: p.id,
      provider: p.provider,
      name: p.name,
      url: playlistUrl(p),
      tracks: p.tracks?.total ?? 0,
    });
  }

  return [...byKey.values()];
}
