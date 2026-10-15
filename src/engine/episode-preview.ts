// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { ParsedFileInfo } from '../types/torrplay';

const BROKEN_IMAGE_PATH = './img/img_broken.svg';
const SEASON_METADATA_TIMEOUT_MS = 1_500;

/**
 * Fetches TMDB season/episode metadata (episode names, air dates, still images)
 * via Lampa's own Api.seasons, mirroring how Lampa's native torrent file list
 * (src/interaction/torrent.js `show()`) resolves per-episode previews.
 */
export async function fetchSeasonEpisodes(
  movie: LampaMovie | undefined,
  seasonNumbers: number[]
): Promise<Record<string, LampaApiSeasonData>> {
  const api = typeof Lampa !== 'undefined' ? Lampa.Api : undefined;
  if (!movie?.id || seasonNumbers.length === 0 || !api || typeof api.seasons !== 'function') {
    return {};
  }

  return new Promise(resolve => {
    let isSettled = false;
    const finish = (data?: Record<string, LampaApiSeasonData>): void => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutId);
      resolve(data || {});
    };
    const timeoutId = setTimeout(() => finish(), SEASON_METADATA_TIMEOUT_MS);

    try {
      api.seasons(movie, seasonNumbers, finish);
    } catch {
      finish();
    }
  });
}

export interface EpisodePreview {
  airDate: string,
  img: string,
  title: string
}

/**
 * Resolves the episode preview (still image, name, air date) for a parsed file,
 * matching Lampa's native fallback to a broken-image placeholder when no still
 * image is available, so the row still reads as a serial-style entry.
 */
export function resolveEpisodePreview(
  fileInfo: ParsedFileInfo,
  seasonsData: Record<string, LampaApiSeasonData>,
  fallbackImage = BROKEN_IMAGE_PATH
): EpisodePreview | undefined {
  if (fileInfo.episode === null || fileInfo.season === null) return undefined;

  const seasonData = seasonsData[String(fileInfo.season)];
  const episode = seasonData?.episodes?.find(candidate => candidate.episode_number === fileInfo.episode);

  const img = episode?.still_path && typeof Lampa !== 'undefined' && Lampa.Api
    ? Lampa.Api.img(episode.still_path)
    : fallbackImage;
  const airDate = episode?.air_date && typeof Lampa !== 'undefined' && Lampa.Utils?.parseTime
    ? Lampa.Utils.parseTime(episode.air_date).full
    : (episode?.air_date || '--');

  return {
    airDate,
    img: img || BROKEN_IMAGE_PATH,
    title: episode?.name || '',
  };
}

/**
 * Collects the distinct season numbers present across a set of parsed files,
 * the same set Lampa's native `show()` gathers before calling Api.seasons.
 */
export function collectSeasonNumbers(fileInfos: ParsedFileInfo[]): number[] {
  const seasons: number[] = [];
  for (const fileInfo of fileInfos) {
    if (fileInfo.serial && fileInfo.season !== null && !seasons.includes(fileInfo.season)) {
      seasons.push(fileInfo.season);
    }
  }
  return seasons;
}
