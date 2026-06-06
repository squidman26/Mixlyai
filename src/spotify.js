import { writeFileSync } from "fs";
import { loadClientConfig, loadTokens, TOKEN_PATH } from "./config.js";
import { refreshAccessToken, login } from "./auth.js";

const API = "https://api.spotify.com/v1";

async function getValidAccessToken() {
  const config = loadClientConfig();
  let tokens = loadTokens();

  if (!tokens) {
    throw new Error(
      "Not logged in. Run: npm run auth  (or: node src/index.js auth)"
    );
  }

  if (Date.now() >= tokens.expires_at - 60_000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token, config);
    tokens = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: Date.now() + refreshed.expires_in * 1000,
    };
    writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  }

  return tokens.access_token;
}

async function api(path, options = {}) {
  const token = await getValidAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw new Error("Spotify session expired. Run: npm run auth");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify API ${path} failed (${res.status}): ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getCurrentUser() {
  return api("/me");
}

export async function searchTrack(artist, title, limit = 5) {
  const q = `track:"${escapeQuery(title)}" artist:"${escapeQuery(artist)}"`;
  const params = new URLSearchParams({ q, type: "track", limit: String(limit) });
  const data = await api(`/search?${params}`);
  return data.tracks?.items ?? [];
}

function escapeQuery(s) {
  return s.replace(/"/g, '\\"');
}

export async function createPlaylist(name, description, isPublic) {
  return api(`/me/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      public: isPublic,
    }),
  });
}

export async function addTracksToPlaylist(playlistId, uris) {
  const chunkSize = 100;
  for (let i = 0; i < uris.length; i += chunkSize) {
    const chunk = uris.slice(i, i + chunkSize);
    await api(`/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: chunk }),
    });
  }
}

export async function getPlaylist(playlistId) {
  return api(`/playlists/${playlistId}`);
}

export async function getAllPlaylistTrackUris(playlistId) {
  const uris = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      fields: "items(track(uri)),total",
    });
    const data = await api(`/playlists/${playlistId}/items?${params}`);

    for (const item of data.items ?? []) {
      if (item.track?.uri) uris.push(item.track.uri);
    }

    offset += data.items?.length ?? 0;
    if (offset >= (data.total ?? 0) || (data.items?.length ?? 0) === 0) break;
  }

  return uris;
}

export async function replacePlaylistTracks(playlistId, uris) {
  if (uris.length === 0) {
    await api(`/playlists/${playlistId}/items`, { method: "PUT", body: JSON.stringify({ uris: [] }) });
    return;
  }

  const chunkSize = 100;
  for (let i = 0; i < uris.length; i += chunkSize) {
    const chunk = uris.slice(i, i + chunkSize);
    const method = i === 0 ? "PUT" : "POST";
    await api(`/playlists/${playlistId}/items`, {
      method,
      body: JSON.stringify({ uris: chunk }),
    });
  }
}

export async function updatePlaylist(playlistId, { name, description, public: isPublic }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  if (isPublic !== undefined) body.public = isPublic;

  if (Object.keys(body).length === 0) return null;

  return api(`/playlists/${playlistId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getUserPlaylists(limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  const data = await api(`/me/playlists?${params}`);
  return data.items ?? [];
}

export { login };
