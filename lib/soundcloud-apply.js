import { getSoundCloudAccessToken } from "./connections.js";
import { createPlaylist } from "./soundcloud.js";
import { matchPlanTracks } from "./soundcloud-match.js";

export async function applyPlanToSoundCloud(accountId, plan) {
  const accessToken = await getSoundCloudAccessToken(accountId);
  const matches = await matchPlanTracks(plan.tracks);
  const matched = matches.filter((row) => row.matched);
  const unmatched = matches.filter((row) => !row.matched);

  if (!matched.length) {
    throw new Error(
      "No tracks could be matched on SoundCloud. Try exporting CSV instead."
    );
  }

  const playlist = await createPlaylist(
    {
      title: plan.playlist.name,
      description: plan.playlist.description,
      trackIds: matched.map((row) => row.track.id),
    },
    accessToken
  );

  return {
    playlist: {
      id: playlist.id ?? null,
      urn: playlist.urn ?? null,
      title: playlist.title ?? plan.playlist.name,
      permalinkUrl: playlist.permalink_url ?? null,
    },
    matched: matched.map((row) => ({
      artist: row.artist,
      title: row.title,
      soundcloudId: row.track.id,
      soundcloudUrl: row.track.permalinkUrl,
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
        soundcloudId: match.track.id,
        soundcloudUrl: match.track.permalinkUrl,
      };
    }),
  };
}
