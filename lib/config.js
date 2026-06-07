import { PROVIDERS } from "./music.js";

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

function isLocalOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getCanonicalBaseUrl() {
  if (trimEnv("APP_BASE_URL")) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }

  if (trimEnv("OAUTH_REDIRECT_URI")) {
    return process.env.OAUTH_REDIRECT_URI.replace(/\/api\/auth\/callback\/?$/, "");
  }

  return "https://mixly.vercel.app";
}

export function isPreviewDeployment(req) {
  const origin = requestOrigin(req);
  if (!origin || isLocalOrigin(origin)) return false;
  return origin !== getCanonicalBaseUrl();
}

function isPreviewUri(uri) {
  if (!uri) return false;
  try {
    const { hostname } = new URL(uri);
    return (
      hostname.includes("-playlistmaker-s-projects") ||
      (hostname.endsWith(".vercel.app") && hostname !== "mixly.vercel.app")
    );
  } catch {
    return false;
  }
}

export function getRedirectUri(req) {
  const origin = requestOrigin(req);
  if (isLocalOrigin(origin)) return `${origin}/api/auth/callback`;

  const envUri = trimEnv("OAUTH_REDIRECT_URI");
  if (envUri && !isPreviewUri(envUri)) return envUri;

  return `${getCanonicalBaseUrl()}/api/auth/callback`;
}

export function getBaseUrl(req) {
  const origin = requestOrigin(req);
  if (isLocalOrigin(origin)) return origin;

  return getCanonicalBaseUrl();
}

export function loadYouTubeConfig(req) {
  return {
    clientId: requireEnv("YOUTUBE_CLIENT_ID"),
    clientSecret: requireEnv("YOUTUBE_CLIENT_SECRET"),
    redirectUri: getRedirectUri(req),
  };
}

export function loadSoundCloudConfig(req) {
  return {
    clientId: requireEnv("SOUNDCLOUD_CLIENT_ID"),
    clientSecret: requireEnv("SOUNDCLOUD_CLIENT_SECRET"),
    redirectUri: getRedirectUri(req),
  };
}

export function loadProviderConfig(provider, req) {
  if (provider === "youtube") return loadYouTubeConfig(req);
  if (provider === "soundcloud") return loadSoundCloudConfig(req);
  throw new Error(`Unknown provider: ${provider}`);
}

export function getProviderAuthConfig(provider) {
  const entry = PROVIDERS[provider];
  if (!entry) throw new Error(`Unknown provider: ${provider}`);
  return entry;
}
