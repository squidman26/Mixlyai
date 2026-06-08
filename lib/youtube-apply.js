import { getYoutubeAccessToken } from "./connections.js";
import {
  addVideoToPlaylist,
  createPlaylist,
  playlistUrl,
} from "./youtube.js";
import { matchPlanTracks } from "./youtube-match.js";

export async function applyPlanToYoutube(accountId, plan) {
  const accessToken = await getYoutubeAccessToken(accountId);
  const matches = await matchPlanTracks(plan.tracks, accessToken);
  const matched = matches.filter((row) => row.matched);
  const unmatched = matches.filter((row) => !row.matched);

  if (!matched.length) {
    throw new Error(
      "No tracks could be matched on YouTube. Try exporting CSV instead."
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

  return {
    playlist: {
      id: playlistId,
      title: created.snippet?.title ?? plan.playlist.name,
      url: playlistUrl(playlistId),
    },
    matched: matched.map((row) => ({
      artist: row.artist,
      title: row.title,
      youtubeVideoId: row.video.id,
      youtubeUrl: row.video.url,
    })),
    unmatched: unmatched.map((row) => ({
      artist: row.artist,
      title: row.title,
    })),
    tracksJson: plan.tracks.map((track) => {
      const match = matches.find(
        (row) => row.artist === track.artist && row.title === track.title
      );
      if (!match?.matched) return track;
      return {
        ...track,
        youtubeVideoId: match.video.id,
        youtubeUrl: match.video.url,
      };
    }),
  };
}
