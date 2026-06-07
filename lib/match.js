import { searchTrack, searchTrackApp } from "./spotify.js";

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCandidate(requestedArtist, requestedTitle, track) {
  const reqArtist = normalize(requestedArtist);
  const reqTitle = normalize(requestedTitle);
  const trackArtists = track.artists.map((a) => normalize(a.name)).join(" ");
  const trackTitle = normalize(track.name);

  let score = 0;
  if (trackTitle === reqTitle) score += 50;
  else if (trackTitle.includes(reqTitle) || reqTitle.includes(trackTitle))
    score += 25;

  if (trackArtists.includes(reqArtist)) score += 40;
  else if (
    track.artists.some(
      (a) =>
        normalize(a.name).includes(reqArtist) ||
        reqArtist.includes(normalize(a.name))
    )
  )
    score += 20;

  score += Math.min(track.popularity ?? 0, 30) * 0.3;
  return score;
}

export function formatTrack(track) {
  const artists = track.artists.map((a) => a.name).join(", ");
  return `${artists} — ${track.name}`;
}

function scoreAndPick(artist, title, candidates) {
  if (candidates.length === 0) {
    return { status: "not_found", track: null, score: 0 };
  }

  const scored = candidates
    .map((track) => ({
      track,
      score: scoreCandidate(artist, title, track),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const confident = best.score >= 45;

  return {
    status: confident ? "matched" : "ambiguous",
    track: best.track,
    score: best.score,
  };
}

export async function matchRowApp(artist, title) {
  const candidates = await searchTrackApp(artist, title);
  return scoreAndPick(artist, title, candidates);
}

export async function matchRow(session, artist, title) {
  const { session: s, tracks: candidates } = await searchTrack(
    session,
    artist,
    title
  );

  const result = scoreAndPick(artist, title, candidates);
  return { session: s, ...result };
}
