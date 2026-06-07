import { loadSoundCloudConfig } from "./config.js";

const API = "https://api.soundcloud.com";
const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";

export const SOUNDCLOUD_SCOPES = "*";

async function refreshAccessToken(refreshToken, config) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SoundCloud token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token ?? refreshToken,
  };
}

export async function ensureValidSession(session) {
  if (!session?.refresh_token || session.provider !== "soundcloud") return null;

  const config = loadSoundCloudConfig();
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

function parseSoundCloudError(status, body, path) {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message =
      parsed.error_description ||
      parsed.error ||
      parsed.message ||
      body;
  } catch {
    /* use raw body */
  }
  return `SoundCloud API ${path} failed (${status}): ${message}`;
}

async function api(session, path, options = {}) {
  const valid = await ensureValidSession(session);
  if (!valid?.access_token) {
    throw new Error("Not authenticated with SoundCloud");
  }

  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `OAuth ${valid.access_token}`,
      Accept: "application/json; charset=utf-8",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw new Error("SoundCloud session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(parseSoundCloudError(res.status, body, path));
  }

  if (res.status === 204) return { session: valid, data: null };
  const data = await res.json();
  return { session: valid, data };
}

function normalizeTrack(track) {
  return {
    id: String(track.id),
    uri: `soundcloud:track:${track.id}`,
    name: track.title ?? "Unknown",
    artists: [{ name: track.user?.username ?? track.user?.full_name ?? "Unknown" }],
    url: track.permalink_url ?? `https://soundcloud.com/track/${track.id}`,
    popularity: track.playback_count ?? 0,
    provider: "soundcloud",
  };
}

function normalizePlaylist(playlist) {
  return {
    id: String(playlist.id),
    name: playlist.title ?? "Untitled",
    description: playlist.description ?? "",
    tracks: { total: playlist.track_count ?? playlist.tracks?.length ?? 0 },
    external_urls: {
      soundcloud: playlist.permalink_url ?? `https://soundcloud.com/playlist/${playlist.id}`,
    },
    provider: "soundcloud",
  };
}

export async function exchangeCode(code, redirectUri, codeVerifier) {
  if (!codeVerifier) {
    throw new Error("SoundCloud OAuth requires PKCE code_verifier");
  }

  const config = loadSoundCloudConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri || config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json; charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SoundCloud token exchange failed (${res.status}): ${err}`);
  }

  const tokens = await res.json();
  const session = {
    provider: "soundcloud",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };

  const { session: withUser, data: user } = await getCurrentUser(session);
  return { ...withUser, user };
}

export async function getCurrentUser(session) {
  const { session: s, data } = await api(session, "/me");
  const user = {
    id: String(data.id),
    display_name: data.full_name ?? data.username ?? "SoundCloud User",
    email: null,
    avatar_url: data.avatar_url ?? null,
    product: data.plan ?? null,
    provider: "soundcloud",
  };
  return { session: s, data: user };
}

export async function searchTrack(session, artist, title, limit = 5) {
  const q = `${artist} ${title}`;
  const params = new URLSearchParams({ q, limit: String(limit) });
  const { session: s, data } = await api(session, `/tracks?${params}`);
  const tracks = (Array.isArray(data) ? data : data.collection ?? []).map(
    normalizeTrack
  );
  return { session: s, tracks };
}

export async function createPlaylist(session, name, description, isPublic) {
  const { session: s, data } = await api(session, "/playlists", {
    method: "POST",
    body: JSON.stringify({
      playlist: {
        title: name,
        description: description ?? "",
        sharing: isPublic ? "public" : "private",
      },
    }),
  });
  return { session: s, playlist: normalizePlaylist(data) };
}

export async function addTracksToPlaylist(session, playlistId, uris) {
  const { session: s, uris: existingUris } = await getAllPlaylistTrackUris(
    session,
    playlistId
  );
  const existing = new Set(existingUris);
  const newUris = uris.filter((uri) => !existing.has(uri));
  if (newUris.length === 0) return s;

  const trackIds = [...existingUris, ...newUris].map((uri) =>
    Number(uri.replace(/^soundcloud:track:/, ""))
  );

  const result = await api(s, `/playlists/${playlistId}`, {
    method: "PUT",
    body: JSON.stringify({
      playlist: { tracks: trackIds.map((id) => ({ id })) },
    }),
  });
  return result.session;
}

export async function getPlaylist(session, playlistId) {
  const { session: s, data } = await api(session, `/playlists/${playlistId}`);
  return { session: s, playlist: normalizePlaylist(data) };
}

export async function getAllPlaylistTrackUris(session, playlistId) {
  const { session: s, data } = await api(
    session,
    `/playlists/${playlistId}?representation=full`
  );
  const tracks = data.tracks ?? [];
  const uris = tracks.map((track) => `soundcloud:track:${track.id}`);
  return { session: s, uris };
}

export async function replacePlaylistTracks(session, playlistId, uris) {
  const trackIds = uris.map((uri) =>
    Number(uri.replace(/^soundcloud:track:/, ""))
  );

  const { session: s } = await api(session, `/playlists/${playlistId}`, {
    method: "PUT",
    body: JSON.stringify({
      playlist: { tracks: trackIds.map((id) => ({ id })) },
    }),
  });
  return s;
}

export async function updatePlaylist(session, playlistId, { name, description, public: isPublic }) {
  const body = { playlist: {} };
  if (name !== undefined) body.playlist.title = name;
  if (description !== undefined) body.playlist.description = description;
  if (isPublic !== undefined) {
    body.playlist.sharing = isPublic ? "public" : "private";
  }

  if (Object.keys(body.playlist).length === 0) return session;

  const { session: s } = await api(session, `/playlists/${playlistId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return s;
}

export async function getUserPlaylists(session, limit = 30) {
  const { session: s, data: user } = await getCurrentUser(session);
  const params = new URLSearchParams({ limit: String(limit) });
  const result = await api(s, `/users/${user.id}/playlists?${params}`);
  const playlists = (Array.isArray(result.data)
    ? result.data
    : result.data.collection ?? []
  ).map(normalizePlaylist);
  return { session: result.session, playlists };
}
