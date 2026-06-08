import { getGoogleClientId, getGoogleClientSecret } from "./google-auth.js";
import { youtubeWatchUrl } from "./youtube-id.js";

export { parseYoutubeVideoId, youtubeWatchUrl } from "./youtube-id.js";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function formatYoutubeError(status, data) {
  const detail =
    data?.error?.message ||
    data?.error?.errors?.map((err) => err.message).filter(Boolean).join("; ") ||
    "Request failed";
  return `YouTube API error (${status}): ${detail}`;
}

export async function refreshGoogleAccessToken(refreshToken) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth is not configured for token refresh");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatYoutubeError(res.status, data));
  }
  return data;
}

function isTokenFresh(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS;
}

export async function youtubeRequest(path, { accessToken, method = "GET", body, query, retry = 0 } = {}) {
  const url = new URL(`${YOUTUBE_API}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429 && retry < 3) {
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** retry));
    return youtubeRequest(path, { accessToken, method, body, query, retry: retry + 1 });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatYoutubeError(res.status, data));
  }
  return data;
}

export async function getVideoById(videoId, accessToken) {
  const data = await youtubeRequest("/videos", {
    accessToken,
    query: {
      part: "snippet",
      id: videoId,
    },
  });
  return data.items?.[0] ?? null;
}

export async function searchVideos(query, accessToken, { maxResults = 5 } = {}) {
  const data = await youtubeRequest("/search", {
    accessToken,
    query: {
      part: "snippet",
      type: "video",
      q: query,
      maxResults,
      videoEmbeddable: "true",
    },
  });
  return data.items ?? [];
}

export async function createPlaylist({ title, description, privacyStatus = "public" }, accessToken) {
  const data = await youtubeRequest("/playlists", {
    accessToken,
    method: "POST",
    query: { part: "snippet,status" },
    body: {
      snippet: {
        title,
        description: description || "",
      },
      status: {
        privacyStatus,
      },
    },
  });
  return data;
}

export async function addVideoToPlaylist({ playlistId, videoId }, accessToken) {
  return youtubeRequest("/playlistItems", {
    accessToken,
    method: "POST",
    query: { part: "snippet" },
    body: {
      snippet: {
        playlistId,
        resourceId: {
          kind: "youtube#video",
          videoId,
        },
      },
    },
  });
}

export function playlistUrl(playlistId) {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

export { isTokenFresh };
