import { searchVideos } from "./youtube.js";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreVideo(item, artist, title) {
  const snippet = item.snippet || {};
  const videoTitle = normalize(snippet.title);
  const channelTitle = normalize(snippet.channelTitle);
  const wantArtist = normalize(artist);
  const wantTitle = normalize(title);

  let score = 0;
  if (videoTitle === wantTitle) score += 4;
  else if (videoTitle.includes(wantTitle) || wantTitle.includes(videoTitle)) score += 2;

  if (channelTitle === wantArtist) score += 4;
  else if (channelTitle.includes(wantArtist) || wantArtist.includes(channelTitle)) score += 2;

  return score;
}

export async function matchTrack({ artist, title }, accessToken) {
  const query = `${artist} ${title}`.trim();
  const candidates = await searchVideos(query, accessToken, { maxResults: 5 });
  let best = null;
  let bestScore = 0;

  for (const item of candidates) {
    const score = scoreVideo(item, artist, title);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (!best?.id?.videoId || bestScore < 3) {
    return {
      artist,
      title,
      matched: false,
      score: bestScore,
      video: null,
    };
  }

  return {
    artist,
    title,
    matched: true,
    score: bestScore,
    video: {
      id: best.id.videoId,
      title: best.snippet?.title ?? title,
      channelTitle: best.snippet?.channelTitle ?? artist,
      url: `https://www.youtube.com/watch?v=${best.id.videoId}`,
    },
  };
}

export async function matchPlanTracks(tracks, accessToken) {
  const results = [];
  for (const track of tracks) {
    results.push(await matchTrack(track, accessToken));
  }
  return results;
}
