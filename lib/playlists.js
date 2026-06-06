export const PLAYLIST_MARKER = "Created with Playlist Builder";

export function playlistDescription(meta = {}) {
  const custom = meta.description?.trim();
  if (!custom) return PLAYLIST_MARKER;
  if (custom.includes(PLAYLIST_MARKER)) return custom;
  return `${custom} · ${PLAYLIST_MARKER}`;
}

export function isGeneratedPlaylist(playlist) {
  const desc = (playlist.description || "").toLowerCase();
  return (
    desc.includes("playlist builder") || desc.includes("playlist-builder")
  );
}

export function recordGeneratedPlaylist(session, playlist, trackCount) {
  const entry = {
    id: playlist.id,
    name: playlist.name,
    url: playlist.external_urls?.spotify,
    tracks: trackCount ?? playlist.tracks?.total ?? 0,
  };

  const existing = session.generatedPlaylists ?? [];
  const filtered = existing.filter((p) => p.id !== entry.id);
  return {
    ...session,
    generatedPlaylists: [entry, ...filtered],
  };
}

export function mergeGeneratedPlaylists(sessionList, spotifyList) {
  const byId = new Map();

  for (const p of sessionList ?? []) {
    if (p.id) byId.set(p.id, p);
  }

  for (const p of spotifyList.filter(isGeneratedPlaylist)) {
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      url: p.external_urls?.spotify,
      tracks: p.tracks?.total ?? 0,
    });
  }

  return [...byId.values()];
}
