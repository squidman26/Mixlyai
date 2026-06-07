import * as youtube from "./youtube.js";
import * as soundcloud from "./soundcloud.js";

export const PROVIDERS = {
  youtube: {
    id: "youtube",
    name: "YouTube Music",
    client: youtube,
    scopes: youtube.YOUTUBE_SCOPES,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  },
  soundcloud: {
    id: "soundcloud",
    name: "SoundCloud",
    client: soundcloud,
    scopes: soundcloud.SOUNDCLOUD_SCOPES,
    authUrl: "https://secure.soundcloud.com/authorize",
  },
};

export function isValidProvider(provider) {
  return provider === "youtube" || provider === "soundcloud";
}

export function getProviderClient(provider) {
  const entry = PROVIDERS[provider];
  if (!entry) throw new Error(`Unknown music provider: ${provider}`);
  return entry.client;
}

export function getProviderName(provider) {
  return PROVIDERS[provider]?.name ?? provider;
}

export async function ensureValidSession(session) {
  if (!session?.provider) return null;
  return getProviderClient(session.provider).ensureValidSession(session);
}

export async function exchangeCode(provider, code, redirectUri, codeVerifier) {
  if (provider === "soundcloud") {
    return soundcloud.exchangeCode(code, redirectUri, codeVerifier);
  }
  return getProviderClient(provider).exchangeCode(code, redirectUri);
}

export async function getCurrentUser(session) {
  return getProviderClient(session.provider).getCurrentUser(session);
}

export async function searchTrack(session, artist, title, limit = 5) {
  return getProviderClient(session.provider).searchTrack(
    session,
    artist,
    title,
    limit
  );
}

export async function createPlaylist(session, name, description, isPublic) {
  return getProviderClient(session.provider).createPlaylist(
    session,
    name,
    description,
    isPublic
  );
}

export async function addTracksToPlaylist(session, playlistId, uris) {
  return getProviderClient(session.provider).addTracksToPlaylist(
    session,
    playlistId,
    uris
  );
}

export async function getPlaylist(session, playlistId) {
  return getProviderClient(session.provider).getPlaylist(session, playlistId);
}

export async function getAllPlaylistTrackUris(session, playlistId) {
  return getProviderClient(session.provider).getAllPlaylistTrackUris(
    session,
    playlistId
  );
}

export async function replacePlaylistTracks(session, playlistId, uris) {
  return getProviderClient(session.provider).replacePlaylistTracks(
    session,
    playlistId,
    uris
  );
}

export async function updatePlaylist(session, playlistId, updates) {
  return getProviderClient(session.provider).updatePlaylist(
    session,
    playlistId,
    updates
  );
}

export async function getUserPlaylists(session, limit = 30) {
  return getProviderClient(session.provider).getUserPlaylists(session, limit);
}

export function playlistUrl(playlist) {
  return (
    playlist.external_urls?.youtube ||
    playlist.external_urls?.soundcloud ||
    playlist.url ||
    null
  );
}
