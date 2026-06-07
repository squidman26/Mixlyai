import fs from "fs";
import path from "path";
import open from "open";
import http from "http";
import { loadConfig } from "./config.js";
import * as youtube from "../lib/youtube.js";
import * as soundcloud from "../lib/soundcloud.js";

const TOKEN_FILE = path.join(process.cwd(), ".mixly-tokens.json");

function getClient(provider) {
  if (provider === "youtube") return youtube;
  if (provider === "soundcloud") return soundcloud;
  throw new Error(`Unknown provider: ${provider}`);
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
}

function saveTokens(session) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(session, null, 2));
}

export async function getValidSession(provider) {
  const tokens = loadTokens();
  if (!tokens || tokens.provider !== provider) {
    throw new Error(`Not logged in to ${provider}. Run: npm run auth -- --provider ${provider}`);
  }
  const client = getClient(provider);
  const valid = await client.ensureValidSession(tokens);
  if (!valid) throw new Error("Session invalid");
  saveTokens(valid);
  return valid;
}

export async function login(provider = "youtube") {
  const config = loadConfig(provider);
  const client = getClient(provider);
  const scopes =
    provider === "youtube" ? youtube.YOUTUBE_SCOPES : soundcloud.SOUNDCLOUD_SCOPES;
  const authUrl =
    provider === "youtube"
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : "https://secure.soundcloud.com/authorize";

  const redirectUri = config.redirectUri;
  const state = Math.random().toString(36).slice(2);

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  if (provider === "youtube") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  const authorizeUrl = `${authUrl}?${params}`;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:8888`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400);
        res.end("Missing code");
        reject(new Error("OAuth failed"));
        server.close();
        return;
      }

      try {
        const session = await client.exchangeCode(code, redirectUri);
        saveTokens(session);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Logged in! You can close this tab.</h1>");
        console.log(`Logged in as ${session.user.display_name}`);
        resolve(session);
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
        reject(err);
      } finally {
        server.close();
      }
    });

    server.listen(8888, "127.0.0.1", () => {
      console.log("Opening browser for login…");
      open(authorizeUrl);
    });
  });
}

export async function searchTrack(provider, artist, title, limit = 5) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const result = await client.searchTrack(session, artist, title, limit);
  saveTokens(result.session);
  return result.tracks;
}

export async function createPlaylist(provider, name, description, isPublic) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const result = await client.createPlaylist(session, name, description, isPublic);
  saveTokens(result.session);
  return result.playlist;
}

export async function addTracksToPlaylist(provider, playlistId, uris) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const updated = await client.addTracksToPlaylist(session, playlistId, uris);
  saveTokens(updated);
}

export async function getPlaylist(provider, playlistId) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const result = await client.getPlaylist(session, playlistId);
  saveTokens(result.session);
  return result.playlist;
}

export async function getAllPlaylistTrackUris(provider, playlistId) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const result = await client.getAllPlaylistTrackUris(session, playlistId);
  saveTokens(result.session);
  return result.uris;
}

export async function replacePlaylistTracks(provider, playlistId, uris) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const updated = await client.replacePlaylistTracks(session, playlistId, uris);
  saveTokens(updated);
}

export async function updatePlaylist(provider, playlistId, updates) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const updated = await client.updatePlaylist(session, playlistId, updates);
  saveTokens(updated);
}

export async function getUserPlaylists(provider, limit = 50) {
  const session = await getValidSession(provider);
  const client = getClient(provider);
  const result = await client.getUserPlaylists(session, limit);
  saveTokens(result.session);
  return result.playlists;
}
