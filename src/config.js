import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Project .env wins over inherited shell vars (e.g. localhost overrides).
dotenv.config({ path: join(projectRoot, ".env"), override: true });

export const SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-private",
].join(" ");

export const TOKEN_PATH =
  process.env.SPOTIFY_TOKEN_PATH ||
  join(projectRoot, ".spotify-tokens.json");

export function trimEnv(name) {
  const value = process.env[name]?.trim();
  if (value) process.env[name] = value;
  return value;
}

export function requireEnv(name) {
  const value = trimEnv(name);
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and set your Spotify app credentials.`
    );
  }
  return value;
}

export function loadClientConfig() {
  return {
    clientId: requireEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
    redirectUri:
      trimEnv("SPOTIFY_REDIRECT_URI") || "http://127.0.0.1:8888/callback",
  };
}

export function loadTokens() {
  if (!existsSync(TOKEN_PATH)) return null;
  return JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
}
