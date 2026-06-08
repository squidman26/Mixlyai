import { getYoutubeAccessToken } from "./connections.js";
import {
  addVideoToPlaylist,
  createPlaylist,
  playlistUrl,
} from "./youtube.js";
import { matchPlanItems } from "./youtube-match.js";
import { getPlanItems } from "../src/plan.js";

function enrichItem(item, match) {
  if (!match?.matched) return item;
  return {
    ...item,
    youtubeVideoId: match.video.id,
    youtubeUrl: match.video.url,
  };
}

export async function applyPlanToYoutube(accountId, plan) {
  const accessToken = await getYoutubeAccessToken(accountId);
  const items = getPlanItems(plan);
  const matches = await matchPlanItems(items, accessToken);
  const matched = matches.filter((row) => row.matched);
  const unmatched = matches.filter((row) => !row.matched);

  if (!matched.length) {
    throw new Error(
      "No items could be matched on YouTube. Try exporting CSV instead."
    );
  }

  const created = await createPlaylist(
    {
      title: plan.playlist.name,
      description: plan.playlist.description,
    },
    accessToken
  );

  const playlistId = created.id;
  if (!playlistId) {
    throw new Error("YouTube did not return a playlist ID");
  }

  for (const row of matched) {
    await addVideoToPlaylist(
      { playlistId, videoId: row.video.id },
      accessToken
    );
  }

  const tracksJson = items.map((item, index) => enrichItem(item, matches[index]));

  return {
    playlist: {
      id: playlistId,
      title: created.snippet?.title ?? plan.playlist.name,
      url: playlistUrl(playlistId),
    },
    matched: matched.map((row) => ({
      type: row.type,
      artist: row.artist ?? null,
      title: row.title,
      channel: row.channel ?? null,
      youtubeVideoId: row.video.id,
      youtubeUrl: row.video.url,
    })),
    unmatched: unmatched.map((row) => ({
      type: row.type,
      artist: row.artist ?? null,
      title: row.title,
      channel: row.channel ?? null,
    })),
    tracksJson,
  };
}
