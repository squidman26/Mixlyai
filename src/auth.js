import { createServer } from "http";
import { writeFileSync } from "fs";
import { URL } from "url";
import open from "open";
import { loadClientConfig, SCOPES, TOKEN_PATH } from "./config.js";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

function buildAuthUrl({ clientId, redirectUri }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
  });
  return `${AUTH_URL}?${params}`;
}

async function exchangeCode(code, config) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken, config) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token ?? refreshToken,
  };
}

function saveTokens(tokens) {
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  const stored = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
  };
  writeFileSync(TOKEN_PATH, JSON.stringify(stored, null, 2));
  return stored;
}

export async function login() {
  const config = loadClientConfig();

  if (config.redirectUri.includes("localhost")) {
    throw new Error(
      'Redirect URI uses "localhost" but Spotify only allows loopback IP literals.\n' +
        "Set SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback in .env and in the Developer Dashboard."
    );
  }

  console.log(`Client ID:     ${config.clientId}`);
  console.log(`Redirect URI:  ${config.redirectUri}`);
  console.log(
    "This must match a Redirect URI on the same app in the Spotify Developer Dashboard.\n"
  );

  const authUrl = buildAuthUrl(config);

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400);
        res.end(`Spotify authorization failed: ${error}`);
        server.close();
        reject(new Error(error));
        return;
      }

      const authCode = url.searchParams.get("code");
      if (!authCode) {
        res.writeHead(400);
        res.end("Missing authorization code");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body><p>Logged in. You can close this tab and return to the terminal.</p></body></html>"
      );
      server.close();
      resolve(authCode);
    });

    server.listen(8888, "127.0.0.1", () => {
      console.log("Opening browser for Spotify login...");
      console.log(`If it does not open, visit:\n${authUrl}\n`);
      open(authUrl).catch(() => {});
    });

    server.on("error", reject);
  });

  const tokens = await exchangeCode(code, config);
  saveTokens(tokens);
  console.log(`Saved tokens to ${TOKEN_PATH}`);
}
