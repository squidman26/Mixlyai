export function parsePlaylistId(input) {
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return trimmed;
  }

  const uriMatch = trimmed.match(/spotify:playlist:([a-zA-Z0-9]{22})/);
  if (uriMatch) return uriMatch[1];

  try {
    const url = new URL(trimmed);
    const pathMatch = url.pathname.match(/\/playlist\/([a-zA-Z0-9]{22})/);
    if (pathMatch) return pathMatch[1];
  } catch {
    // not a URL
  }

  throw new Error(
    "Invalid playlist ID. Use the 22-character ID or a Spotify playlist URL."
  );
}
