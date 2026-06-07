import { loadYouTubeConfig } from "./config.js";

const API = "https://www.googleapis.com/youtube/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

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
    throw new Error(`YouTube token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token ?? refreshToken,
  };
}

export async function ensureValidSession(session) {
  if (!session?.refresh_token || session.provider !== "youtube") return null;

  const config = loadYouTubeConfig();
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

function parseYouTubeError(status, body, path) {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message =
      parsed.error?.message ||
      parsed.error_description ||
      parsed.message ||
      body;
  } catch {
    /* use raw body */
  }
  return `YouTube API ${path} failed (${status}): ${message}`;
}

async function api(session, path, options = {}) {
  const valid = await ensureValidSession(session);
  if (!valid?.access_token) {
    throw new Error("Not authenticated with YouTube Music");
  }

  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${valid.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw new Error("YouTube session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(parseYouTubeError(res.status, body, path));
  }

  if (res.status === 204) return { session: valid, data: null };
  const data = await res.json();
  return { session: valid, data };
}

function normalizeVideo(item) {
  const videoId = item.id?.videoId || item.id;
  return {
    id: videoId,
    uri: `youtube:video:${videoId}`,
    name: item.snippet?.title ?? "Unknown",
    artists: [{ name: item.snippet?.channelTitle ?? "Unknown" }],
    url: `https://music.youtube.com/watch?v=${videoId}`,
    popularity: null,
    provider: "youtube",
  };
}

function normalizePlaylist(item) {
  const id = item.id;
  return {
    id,
    name: item.snippet?.title ?? "Untitled",
    description: item.snippet?.description ?? "",
    tracks: { total: item.contentDetails?.itemCount ?? 0 },
    external_urls: {
      youtube: `https://music.youtube.com/playlist?list=${id}`,
    },
    provider: "youtube",
  };
}

export async function exchangeCode(code, redirectUri) {
  const config = loadYouTubeConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri || config.redirectUri,
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
    throw new Error(`YouTube token exchange failed (${res.status}): ${err}`);
  }

  const tokens = await res.json();
  const session = {
    provider: "youtube",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };

  const { session: withUser, data: user } = await getCurrentUser(session);
  return { ...withUser, user };
}

export async function getCurrentUser(session) {
  const valid = await ensureValidSession(session);
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${valid.access_token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube user info failed (${res.status}): ${err}`);
  }

  const profile = await res.json();
  const user = {
    id: profile.id,
    display_name: profile.name ?? profile.email ?? "YouTube User",
    email: profile.email ?? null,
    avatar_url: profile.picture ?? null,
    product: null,
    provider: "youtube",
  };

  return { session: valid, data: user };
}

export async function searchTrack(session, artist, title, limit = 5) {
  const q = `${artist} ${title}`;
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: String(limit),
    q,
  });
  const { session: s, data } = await api(session, `/search?${params}`);
  const tracks = (data.items ?? []).map(normalizeVideo);
  return { session: s, tracks };
}

export async function createPlaylist(session, name, description, isPublic) {
  const { session: s, data } = await api(session, "/playlists?part=snippet,status", {
    method: "POST",
    body: JSON.stringify({
      snippet: { title: name, description: description ?? "" },
      status: { privacyStatus: isPublic ? "public" : "private" },
    }),
  });
  return { session: s, playlist: normalizePlaylist(data) };
}

export async function addTracksToPlaylist(session, playlistId, uris) {
  let s = session;
  for (const uri of uris) {
    const videoId = uri.replace(/^youtube:video:/, "");
    const result = await api(s, "/playlistItems?part=snippet", {
      method: "POST",
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: { kind: "youtube#video", videoId },
        },
      }),
    });
    s = result.session;
  }
  return s;
}

export async function getPlaylist(session, playlistId) {
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: playlistId,
  });
  const { session: s, data } = await api(session, `/playlists?${params}`);
  const item = data.items?.[0];
  if (!item) throw new Error(`YouTube playlist not found: ${playlistId}`);
  return { session: s, playlist: normalizePlaylist(item) };
}

export async function getAllPlaylistTrackUris(session, playlistId) {
  const uris = [];
  let pageToken = "";
  let s = session;

  while (true) {
    const params = new URLSearchParams({
      part: "contentDetails",
      playlistId,
      maxResults: "50",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const result = await api(s, `/playlistItems?${params}`);
    s = result.session;
    const data = result.data;

    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      if (videoId) uris.push(`youtube:video:${videoId}`);
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return { session: s, uris };
}

export async function replacePlaylistTracks(session, playlistId, uris) {
  let s = session;

  const listParams = new URLSearchParams({
    part: "contentDetails",
    playlistId,
    maxResults: "50",
  });
  let pageToken = "";

  while (true) {
    const params = new URLSearchParams(listParams);
    if (pageToken) params.set("pageToken", pageToken);

    const result = await api(s, `/playlistItems?${params}`);
    s = result.session;

    for (const item of result.data.items ?? []) {
      const deleteResult = await api(
        s,
        `/playlistItems?id=${item.id}`,
        { method: "DELETE" }
      );
      s = deleteResult.session;
    }

    pageToken = result.data.nextPageToken;
    if (!pageToken) break;
  }

  if (uris.length > 0) {
    s = await addTracksToPlaylist(s, playlistId, uris);
  }

  return s;
}

export async function updatePlaylist(session, playlistId, { name, description, public: isPublic }) {
  const body = { id: playlistId, snippet: {}, status: {} };
  if (name !== undefined) body.snippet.title = name;
  if (description !== undefined) body.snippet.description = description;
  if (isPublic !== undefined) {
    body.status.privacyStatus = isPublic ? "public" : "private";
  }

  if (
    Object.keys(body.snippet).length === 0 &&
    Object.keys(body.status).length === 0
  ) {
    return session;
  }

  const { session: s } = await api(session, "/playlists?part=snippet,status", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return s;
}

export async function getUserPlaylists(session, limit = 30) {
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    mine: "true",
    maxResults: String(Math.min(limit, 50)),
  });
  const { session: s, data } = await api(session, `/playlists?${params}`);
  const playlists = (data.items ?? []).map(normalizePlaylist);
  return { session: s, playlists };
}
