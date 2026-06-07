import crypto from "crypto";
import { getBaseUrl, trimEnv } from "./config.js";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";
import { parseCookies, seal, unseal } from "./session.js";

const API_BASE = "https://api.soundcloud.com";
const AUTH_BASE = "https://secure.soundcloud.com";
const TOKEN_URL = `${AUTH_BASE}/oauth/token`;
const APP_TOKEN_PROVIDER = "soundcloud_app";
const OAUTH_COOKIE = "sc_oauth";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const MAX_RATE_LIMIT_RETRIES = 4;

function getClientId() {
  return trimEnv("SOUNDCLOUD_CLIENT_ID");
}

function getClientSecret() {
  return trimEnv("SOUNDCLOUD_CLIENT_SECRET");
}

export function isSoundCloudConfigured() {
  return Boolean(getClientId() && getClientSecret());
}

export function getSoundCloudRedirectUri(req) {
  const override = trimEnv("SOUNDCLOUD_REDIRECT_URI");
  if (override) return override.replace(/\/$/, "");
  return `${getBaseUrl(req)}/api/auth/soundcloud-callback`;
}

export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl(req, { state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getSoundCloudRedirectUri(req),
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return `${AUTH_BASE}/authorize?${params}`;
}

function appendCookie(res, cookie) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookie);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookie]);
  else res.setHeader("Set-Cookie", [prev, cookie]);
}

function oauthCookieFlags(maxAge) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function setSoundCloudOAuthCookie(res, payload) {
  const value = seal({
    ...payload,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  appendCookie(res, `${OAUTH_COOKIE}=${value}; ${oauthCookieFlags(600)}`);
}

export function readSoundCloudOAuthCookie(req) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = unseal(cookies[OAUTH_COOKIE]);
  if (!payload || payload.expiresAt < Date.now()) return null;
  return payload;
}

export function clearSoundCloudOAuthCookie(res) {
  appendCookie(res, `${OAUTH_COOKIE}=; ${oauthCookieFlags(0)}`);
}

function basicAuthHeader() {
  const credentials = Buffer.from(
    `${getClientId()}:${getClientSecret()}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

function tokenExpiresAt(expiresIn) {
  return new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
}

function isTokenFresh(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS;
}

async function parseTokenResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      data.error_description ||
      data.error ||
      data.message ||
      res.statusText;
    throw new Error(`SoundCloud token error (${res.status}): ${detail}`);
  }
  if (!data.access_token) {
    throw new Error("SoundCloud token response missing access_token");
  }
  return data;
}

export async function exchangeAuthorizationCode({
  code,
  redirectUri,
  codeVerifier,
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    code,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json; charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return parseTokenResponse(res);
}

export async function exchangeRefreshToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json; charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return parseTokenResponse(res);
}

export async function exchangeClientCredentials() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json; charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });

  return parseTokenResponse(res);
}

export async function signOut(accessToken) {
  if (!accessToken) return;

  await fetch(`${AUTH_BASE}/sign-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  }).catch(() => {});
}

async function loadAppTokenRow() {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_provider_tokens")
    .select("access_token, refresh_token, expires_at, scope")
    .eq("provider", APP_TOKEN_PROVIDER)
    .maybeSingle();

  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load app token: ${error.message}`);
  return data;
}

async function saveAppTokenRow(tokens) {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("app_provider_tokens").upsert(
    {
      provider: APP_TOKEN_PROVIDER,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokenExpiresAt(tokens.expires_in),
      scope: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" }
  );

  if (error?.code === "PGRST205") return;
  if (error) throw new Error(`Failed to save app token: ${error.message}`);
}

export async function getAppAccessToken() {
  if (!isSoundCloudConfigured()) {
    throw new Error("SoundCloud is not configured");
  }

  const cached = await loadAppTokenRow();
  if (cached?.access_token && isTokenFresh(cached.expires_at)) {
    return cached.access_token;
  }

  if (cached?.refresh_token) {
    try {
      const tokens = await exchangeRefreshToken(cached.refresh_token);
      await saveAppTokenRow(tokens);
      return tokens.access_token;
    } catch (err) {
      console.warn("SoundCloud app token refresh failed:", err.message);
    }
  }

  const tokens = await exchangeClientCredentials();
  await saveAppTokenRow(tokens);
  return tokens.access_token;
}

function buildApiUrl(path, query) {
  const url = path.startsWith("http") ? new URL(path) : new URL(path, API_BASE);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function formatApiError(status, data) {
  const detail =
    data?.message ||
    data?.errors?.map((err) => err.error_message || err.message).filter(Boolean).join("; ") ||
    data?.error ||
    "Request failed";
  return `SoundCloud API error (${status}): ${detail}`;
}

export async function soundcloudRequest(
  path,
  { accessToken, method = "GET", body, query, retry = 0 } = {}
) {
  if (!accessToken) {
    throw new Error("SoundCloud access token is required");
  }

  const res = await fetch(buildApiUrl(path, query), {
    method,
    headers: {
      accept: "application/json; charset=utf-8",
      Authorization: `OAuth ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429 && retry < MAX_RATE_LIMIT_RETRIES) {
    const delayMs = Math.min(1000 * 2 ** retry, 30000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return soundcloudRequest(path, {
      accessToken,
      method,
      body,
      query,
      retry: retry + 1,
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(res.status, data));
  }

  return data;
}

export async function fetchAllPages(path, { accessToken, query = {} } = {}) {
  const items = [];
  let nextPath = buildApiUrl(path, {
    linked_partitioning: "true",
    ...query,
  });

  while (nextPath) {
    const page = await soundcloudRequest(nextPath, { accessToken });
    if (Array.isArray(page.collection)) {
      items.push(...page.collection);
    } else if (Array.isArray(page)) {
      items.push(...page);
      break;
    }
    nextPath = page.next_href || null;
  }

  return items;
}

export async function getMe(accessToken) {
  return soundcloudRequest("/me", { accessToken });
}

export async function resolveUrl(url, accessToken) {
  return soundcloudRequest("/resolve", {
    accessToken,
    query: { url },
  });
}

export async function searchTracks(query, accessToken, options = {}) {
  return fetchAllPages("/tracks", {
    accessToken,
    query: {
      q: query,
      access: options.access ?? "playable",
      limit: options.limit ?? 50,
      ...options.filters,
    },
  });
}

export async function createPlaylist(
  { title, description, trackIds, sharing = "public" },
  accessToken
) {
  if (!trackIds?.length) {
    throw new Error("At least one matched track is required to create a playlist");
  }

  return soundcloudRequest("/playlists", {
    accessToken,
    method: "POST",
    body: {
      playlist: {
        title,
        description: description || "",
        sharing,
        tracks: trackIds.map((id) => ({ id: Number(id) })),
      },
    },
  });
}

export function normalizeTokenBundle(tokens) {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokenExpiresAt(tokens.expires_in),
    scope: tokens.scope ?? null,
  };
}
