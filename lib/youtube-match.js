import { getVideoById, searchVideos } from "./youtube.js";
import { parseYoutubeVideoId, youtubeWatchUrl } from "./youtube-id.js";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreTrackVideo(item, artist, title) {
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

function scoreVideoItem(item, title, channel) {
  const snippet = item.snippet || {};
  const videoTitle = normalize(snippet.title);
  const channelTitle = normalize(snippet.channelTitle);
  const wantTitle = normalize(title);
  const wantChannel = normalize(channel);

  let score = 0;
  if (videoTitle === wantTitle) score += 5;
  else if (videoTitle.includes(wantTitle) || wantTitle.includes(videoTitle)) score += 3;

  if (wantChannel) {
    if (channelTitle === wantChannel) score += 4;
    else if (channelTitle.includes(wantChannel) || wantChannel.includes(channelTitle)) score += 2;
  }

  return score;
}

function toVideoResult(videoId, snippet, fallback = {}) {
  return {
    id: videoId,
    title: snippet?.title ?? fallback.title ?? "YouTube video",
    channelTitle: snippet?.channelTitle ?? fallback.channel ?? "",
    url: youtubeWatchUrl(videoId),
  };
}

export async function matchTrack({ artist, title }, accessToken) {
  const query = `${artist} ${title}`.trim();
  const candidates = await searchVideos(query, accessToken, { maxResults: 5 });
  let best = null;
  let bestScore = 0;

  for (const item of candidates) {
    const score = scoreTrackVideo(item, artist, title);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (!best?.id?.videoId || bestScore < 3) {
    return {
      type: "track",
      artist,
      title,
      matched: false,
      score: bestScore,
      video: null,
    };
  }

  return {
    type: "track",
    artist,
    title,
    matched: true,
    score: bestScore,
    video: toVideoResult(best.id.videoId, best.snippet, { title, channel: artist }),
  };
}

export async function matchVideo(
  { title, channel = "", youtubeUrl = "", youtubeVideoId = "", searchQuery = "" },
  accessToken
) {
  const videoId =
    youtubeVideoId?.trim() ||
    parseYoutubeVideoId(youtubeUrl) ||
    parseYoutubeVideoId(title);

  if (videoId) {
    const item = await getVideoById(videoId, accessToken);
    if (!item?.id) {
      return {
        type: "video",
        title,
        channel,
        matched: false,
        score: 0,
        video: null,
      };
    }

    return {
      type: "video",
      title: title || item.snippet?.title || "YouTube video",
      channel: channel || item.snippet?.channelTitle || "",
      matched: true,
      score: 10,
      video: toVideoResult(item.id, item.snippet, { title, channel }),
    };
  }

  const query = searchQuery?.trim() || [channel, title].filter(Boolean).join(" ").trim();
  if (!query) {
    return {
      type: "video",
      title,
      channel,
      matched: false,
      score: 0,
      video: null,
    };
  }

  const candidates = await searchVideos(query, accessToken, { maxResults: 5 });
  let best = null;
  let bestScore = 0;

  for (const item of candidates) {
    const score = scoreVideoItem(item, title, channel);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (!best?.id?.videoId || bestScore < 3) {
    return {
      type: "video",
      title,
      channel,
      matched: false,
      score: bestScore,
      video: null,
    };
  }

  return {
    type: "video",
    title,
    channel,
    matched: true,
    score: bestScore,
    video: toVideoResult(best.id.videoId, best.snippet, { title, channel }),
  };
}

export async function matchItem(item, accessToken) {
  if (item.type === "video") {
    return matchVideo(item, accessToken);
  }
  return matchTrack(item, accessToken);
}

export async function matchPlanItems(items, accessToken) {
  const results = [];
  for (const item of items) {
    results.push(await matchItem(item, accessToken));
  }
  return results;
}

export async function matchPlanTracks(tracks, accessToken) {
  return matchPlanItems(tracks, accessToken);
}
