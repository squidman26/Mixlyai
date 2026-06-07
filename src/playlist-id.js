export function parsePlaylistId(input, provider = "youtube") {
  const trimmed = input.trim();

  if (provider === "youtube") {
    if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes("/")) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);
      const listId = url.searchParams.get("list");
      if (listId) return listId;

      const pathMatch = url.pathname.match(/\/playlist\/([a-zA-Z0-9_-]+)/);
      if (pathMatch) return pathMatch[1];
    } catch {
      // not a URL
    }

    throw new Error(
      "Invalid YouTube playlist ID. Use the playlist ID or a YouTube Music / YouTube playlist URL."
    );
  }

  if (provider === "soundcloud") {
    if (/^\d+$/.test(trimmed)) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);
      const pathMatch = url.pathname.match(/\/sets\/([^/]+)/);
      if (pathMatch) return pathMatch[1];
    } catch {
      // not a URL
    }

    throw new Error(
      "Invalid SoundCloud playlist ID. Use the numeric ID or a SoundCloud playlist URL."
    );
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
