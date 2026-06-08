import { trimEnv } from "./config.js";
import { isSupabaseConfigured } from "./supabase.js";
import { parseCookies, seal, unseal } from "./session.js";

const YOUTUBE_OAUTH_COOKIE = "yt_oauth";

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
      trimEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      trimEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") &&
      getGoogleClientId()
  );
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

export function setYoutubeOAuthPending(res, { accountId }) {
  const value = seal({
    accountId,
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
