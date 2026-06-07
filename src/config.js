import dotenv from "dotenv";

dotenv.config();

function trimEnv(name) {
  const value = process.env[name]?.trim();
  if (value) process.env[name] = value;
  return value;
}

function requireEnv(name) {
  const value = trimEnv(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function loadConfig(provider = "youtube") {
  if (provider === "youtube") {
    return {
      clientId: requireEnv("YOUTUBE_CLIENT_ID"),
      clientSecret: requireEnv("YOUTUBE_CLIENT_SECRET"),
      redirectUri:
        trimEnv("OAUTH_REDIRECT_URI") || "http://127.0.0.1:8888/callback",
    };
  }

  if (provider === "soundcloud") {
    return {
      clientId: requireEnv("SOUNDCLOUD_CLIENT_ID"),
      clientSecret: requireEnv("SOUNDCLOUD_CLIENT_SECRET"),
      redirectUri:
        trimEnv("OAUTH_REDIRECT_URI") || "http://127.0.0.1:8888/callback",
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}
