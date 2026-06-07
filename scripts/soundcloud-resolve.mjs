#!/usr/bin/env node
/**
 * Obtain a SoundCloud client-credentials token and resolve a public track URL.
 *
 * Usage:
 *   SOUNDCLOUD_CLIENT_ID=... SOUNDCLOUD_CLIENT_SECRET=... node scripts/soundcloud-resolve.mjs [track-url]
 */

import "dotenv/config";

const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
const API_BASE = "https://api.soundcloud.com";
const MAX_ATTEMPTS = 3;
const DEFAULT_TRACK_URL = "https://soundcloud.com/forss/flickermood";

function trimEnv(name) {
  return process.env[name]?.trim() || "";
}

function basicAuthHeader(clientId, clientSecret) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(data, statusText) {
  return (
    data?.error_description ||
    data?.error ||
    data?.message ||
    data?.errors?.map((err) => err.error_message).filter(Boolean).join("; ") ||
    statusText ||
    "Request failed"
  );
}

async function fetchWithRetry(url, options, label) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, options);
    console.log(`${label}: HTTP ${res.status}`);

    if (res.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      const delayMs = 1000 * 2 ** attempt;
      console.log(`${label}: rate limited, retrying in ${delayMs}ms`);
      await sleep(delayMs);
      continue;
    }

    return res;
  }

  throw new Error(`${label}: exceeded retry limit after rate limiting`);
}

async function obtainAccessToken(clientId, clientSecret) {
  const res = await fetchWithRetry(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        accept: "application/json; charset=utf-8",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(clientId, clientSecret),
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    },
    "Token exchange"
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${formatError(data, res.statusText)}`);
  }
  if (!data.access_token) {
    throw new Error("Token exchange failed: response missing access_token");
  }
  return data.access_token;
}

async function resolveTrack(accessToken, trackUrl) {
  const url = new URL(`${API_BASE}/resolve`);
  url.searchParams.set("url", trackUrl);

  const res = await fetchWithRetry(
    url,
    {
      headers: {
        accept: "application/json; charset=utf-8",
        Authorization: `OAuth ${accessToken}`,
      },
    },
    "Resolve"
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resolve failed: ${formatError(data, res.statusText)}`);
  }
  return data;
}

async function main() {
  const clientId = trimEnv("SOUNDCLOUD_CLIENT_ID");
  const clientSecret = trimEnv("SOUNDCLOUD_CLIENT_SECRET");
  const trackUrl = process.argv[2] || DEFAULT_TRACK_URL;

  if (!clientId || !clientSecret) {
    console.error("Missing SOUNDCLOUD_CLIENT_ID or SOUNDCLOUD_CLIENT_SECRET");
    process.exitCode = 1;
    return;
  }

  try {
    console.log(`Resolving: ${trackUrl}`);
    const accessToken = await obtainAccessToken(clientId, clientSecret);
    const resource = await resolveTrack(accessToken, trackUrl);
    const title = resource.title || resource.full_name || resource.kind || "resource";
    const id = resource.id ?? resource.urn ?? "unknown";
    console.log(`Resolved: ${title} (id: ${id})`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

main();
