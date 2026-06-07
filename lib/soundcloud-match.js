import { getAppAccessToken, soundcloudRequest } from "./soundcloud.js";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreTrack(track, artist, title) {
  const wantArtist = normalize(artist);
  const wantTitle = normalize(title);
  const trackTitle = normalize(track.title);
  const trackArtist = normalize(
    track.user?.username || track.user?.permalink || track.publisher_metadata?.artist
  );

  let score = 0;
  if (trackTitle === wantTitle) score += 4;
  else if (trackTitle.includes(wantTitle) || wantTitle.includes(trackTitle)) score += 2;

  if (trackArtist === wantArtist) score += 4;
  else if (trackArtist.includes(wantArtist) || wantArtist.includes(trackArtist)) score += 2;

  if (track.access === "playable") score += 1;
  return score;
}

async function searchCandidates(query) {
  const accessToken = await getAppAccessToken();
  const data = await soundcloudRequest("/tracks", {
    accessToken,
    query: {
      q: query,
      access: "playable",
      limit: 5,
      linked_partitioning: "true",
    },
  });

  if (Array.isArray(data)) return data;
  return data.collection || [];
}

export async function matchTrack({ artist, title }) {
  const query = `${artist} ${title}`.trim();
  const candidates = await searchCandidates(query);
  let best = null;
  let bestScore = 0;

  for (const track of candidates) {
    const score = scoreTrack(track, artist, title);
    if (score > bestScore) {
      best = track;
      bestScore = score;
    }
  }

  if (!best || bestScore < 3) {
    return {
      artist,
      title,
      matched: false,
      score: bestScore,
      track: null,
    };
  }

  return {
    artist,
    title,
    matched: true,
    score: bestScore,
    track: {
      id: best.id,
      urn: best.urn ?? `soundcloud:tracks:${best.id}`,
      title: best.title,
      permalinkUrl: best.permalink_url ?? null,
      access: best.access ?? null,
    },
  };
}

export async function matchPlanTracks(tracks) {
  const results = [];
  for (const track of tracks) {
    results.push(await matchTrack(track));
  }
  return results;
}
