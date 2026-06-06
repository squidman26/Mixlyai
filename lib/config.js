export const SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-private",
].join(" ");

export function trimEnv(name) {
  const value = process.env[name]?.trim();
  if (value) process.env[name] = value;
  return value;
}

export function requireEnv(name) {
  const value = trimEnv(name);
  if (!value) throw new Error(`Missing server env: ${name}`);
  return value;
}

function requestOrigin(req) {
  const host =
    req?.headers?.["x-forwarded-host"]?.split(",")[0]?.trim() ||
    req?.headers?.host;
  if (!host) return null;

  const proto =
    req?.headers?.["x-forwarded-proto"]?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}

export function getRedirectUri(req) {
  const origin = requestOrigin(req);
  if (origin) return `${origin}/api/auth/callback`;

  if (trimEnv("SPOTIFY_REDIRECT_URI")) return process.env.SPOTIFY_REDIRECT_URI;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/auth/callback`;
  }
  return "http://localhost:3000/api/auth/callback";
}

export function getBaseUrl(req) {
  const origin = requestOrigin(req);
  if (origin) return origin;

  if (trimEnv("APP_BASE_URL")) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function loadSpotifyConfig(req) {
  return {
    clientId: requireEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
    redirectUri: getRedirectUri(req),
  };
}

