import crypto from "crypto";
import { getBaseUrl, trimEnv } from "./config.js";
import { isSupabaseConfigured } from "./supabase.js";
import { parseCookies, seal, unseal } from "./session.js";

const YOUTUBE_OAUTH_COOKIE = "yt_oauth";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube",
  "openid",
  "email",
  "profile",
];

export function getGoogleClientId() {
  return trimEnv("GOOGLE_CLIENT_ID");
}

export function getGoogleClientSecret() {
  return (
    trimEnv("GOOGLE_CLIENT_SECRET") ||
    trimEnv("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET")
  );
}

export function isYoutubeOAuthConfigured() {
  return Boolean(
    isSupabaseConfigured() &&
      getGoogleClientId() &&
      getGoogleClientSecret()
  );
}

export function getYoutubeRedirectUri(req) {
  const override = trimEnv("GOOGLE_REDIRECT_URI");
  if (override) return override.replace(/\/$/, "");
  return `${getBaseUrl(req)}/api/auth/youtube-callback`;
}

export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildGoogleAuthorizeUrl(req, { state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getYoutubeRedirectUri(req),
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGoogleAuthorizationCode({
  code,
  redirectUri,
  codeVerifier,
}) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      code,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error_description || data.error || res.statusText;
    throw new Error(`Google token error (${res.status}): ${detail}`);
  }
  if (!data.access_token) {
    throw new Error("Google token response missing access_token");
  }
  return data;
}

export async function fetchGoogleUserProfile(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || "Failed to load Google profile");
  }
  return data;
}

export function getSupabasePublicConfig() {
  return {
    supabaseUrl: trimEnv("NEXT_PUBLIC_SUPABASE_URL") || trimEnv("SUPABASE_URL"),
    supabasePublishableKey:
      trimEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
      trimEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    googleClientId: getGoogleClientId(),
    youtubeOAuthEnabled: isYoutubeOAuthConfigured(),
  };
}

function oauthCookieFlags(maxAge) {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

function appendCookie(res, cookie) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookie);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookie]);
  else res.setHeader("Set-Cookie", [prev, cookie]);
}

export function setYoutubeOAuthPending(res, { accountId, state, codeVerifier }) {
  const value = seal({
    accountId,
    state,
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  appendCookie(res, `${YOUTUBE_OAUTH_COOKIE}=${value}; ${oauthCookieFlags(600)}`);
}

export function readYoutubeOAuthPending(req) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = unseal(cookies[YOUTUBE_OAUTH_COOKIE]);
  if (!payload || payload.expiresAt < Date.now()) return null;
  return payload;
}

export function clearYoutubeOAuthPending(res) {
  appendCookie(res, `${YOUTUBE_OAUTH_COOKIE}=; ${oauthCookieFlags(0)}`);
}

export function tokenExpiresAt(expiresIn) {
  if (!expiresIn) return null;
  return new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
}
