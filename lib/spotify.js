import { loadSpotifyConfig } from "./config.js";

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

async function refreshAccessToken(refreshToken, config) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token ?? refreshToken,
  };
}

export async function ensureValidSession(session) {
  if (!session?.refresh_token) return null;

  const config = loadSpotifyConfig();
  if (Date.now() < (session.expires_at ?? 0) - 60_000) {
    return session;
  }

  const refreshed = await refreshAccessToken(session.refresh_token, config);
  return {
    ...session,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
  };
}

async function api(session, path, options = {}) {
  const valid = await ensureValidSession(session);
  if (!valid?.access_token) {
    throw new Error("Not authenticated with Spotify");
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${valid.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw new Error("Spotify session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify API ${path} failed (${res.status}): ${body}`);
  }

  if (res.status === 204) return { session: valid, data: null };
  const data = await res.json();
  return { session: valid, data };
}

export async function exchangeCode(code, redirectUri) {
  const config = loadSpotifyConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri || config.redirectUri,
  });
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  const tokens = await res.json();
  const session = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };

  const { session: withUser, data: user } = await getCurrentUser(session);
  return { ...withUser, user };
}

export async function getCurrentUser(session) {
  const { session: s, data } = await api(session, "/me");
  return { session: s, data };
}

export async function searchTrack(session, artist, title, limit = 5) {
  const q = `track:"${escapeQuery(title)}" artist:"${escapeQuery(artist)}"`;
  const params = new URLSearchParams({ q, type: "track", limit: String(limit) });
  const { session: s, data } = await api(session, `/search?${params}`);
  return { session: s, tracks: data.tracks?.items ?? [] };
}

function escapeQuery(s) {
  return s.replace(/"/g, '\\"');
}

export async function createPlaylist(session, name, description, isPublic) {
  const { session: s, data } = await api(session, `/me/playlists`, {
    method: "POST",
    body: JSON.stringify({ name, description, public: isPublic }),
  });
  return { session: s, playlist: data };
}

export async function addTracksToPlaylist(session, playlistId, uris) {
  let s = session;
  const chunkSize = 100;
  for (let i = 0; i < uris.length; i += chunkSize) {
    const chunk = uris.slice(i, i + chunkSize);
    const result = await api(s, `/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: chunk }),
    });
    s = result.session;
  }
  return s;
}

export async function getPlaylist(session, playlistId) {
  const { session: s, data } = await api(session, `/playlists/${playlistId}`);
  return { session: s, playlist: data };
}

export async function getAllPlaylistTrackUris(session, playlistId) {
  const uris = [];
  let offset = 0;
  const limit = 100;
  let s = session;

  while (true) {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      fields: "items(track(uri)),total",
    });
    const result = await api(s, `/playlists/${playlistId}/items?${params}`);
    s = result.session;
    const data = result.data;

    for (const item of data.items ?? []) {
      if (item.track?.uri) uris.push(item.track.uri);
    }

    offset += data.items?.length ?? 0;
    if (offset >= (data.total ?? 0) || (data.items?.length ?? 0) === 0) break;
  }

  return { session: s, uris };
}

export async function replacePlaylistTracks(session, playlistId, uris) {
  let s = session;
  if (uris.length === 0) {
    const result = await api(s, `/playlists/${playlistId}/items`, {
      method: "PUT",
      body: JSON.stringify({ uris: [] }),
    });
    return result.session;
  }

  const chunkSize = 100;
  for (let i = 0; i < uris.length; i += chunkSize) {
    const chunk = uris.slice(i, i + chunkSize);
    const method = i === 0 ? "PUT" : "POST";
    const result = await api(s, `/playlists/${playlistId}/items`, {
      method,
      body: JSON.stringify({ uris: chunk }),
    });
    s = result.session;
  }
  return s;
}

export async function updatePlaylist(session, playlistId, { name, description, public: isPublic }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  if (isPublic !== undefined) body.public = isPublic;
  if (Object.keys(body).length === 0) return session;

  const { session: s } = await api(session, `/playlists/${playlistId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return s;
}

export async function getUserPlaylists(session, limit = 30) {
  const params = new URLSearchParams({ limit: String(limit) });
  const { session: s, data } = await api(session, `/me/playlists?${params}`);
  return { session: s, playlists: data.items ?? [] };
}
