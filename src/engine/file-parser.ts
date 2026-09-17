// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { ParsedFileInfo } from '../types/torrplay';

export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'm4v', 'ts', 'm2ts', 'webm', 'flv', 'vob'];

const EPISODE_PATTERNS: Array<[RegExp, Array<'season' | 'episode'>]> = [
  [/\bs(\d+)\.?ep?(\d+)\b/i, ['season', 'episode']],
  [/\b(\d{1,2})[x-](\d+)\b/i, ['season', 'episode']],
  [/\bs(\d{2})(\d{2,3})\b/i, ['season', 'episode']],
  [/season (\d+) episode (\d+)/i, ['season', 'episode']],
  [/сезон (\d+) серия (\d+)/i, ['season', 'episode']],
  [/(\d+) season (\d+) episode/i, ['season', 'episode']],
  [/(\d+) сезон (\d+) серия/i, ['season', 'episode']],
  [/episode (\d+)/i, ['episode']],
  [/серия (\d+)/i, ['episode']],
  [/(\d+) episode/i, ['episode']],
  [/(\d+) серия/i, ['episode']],
  [/season (\d+)/i, ['season']],
  [/сезон (\d+)/i, ['season']],
  [/(\d+) season/i, ['season']],
  [/(\d+) сезон/i, ['season']],
  [/\bs(\d+)\b/i, ['season']],
  [/\bep?\.?(\d+)\b/i, ['episode']],
  [/\b(\d{1,3}) of (\d+)/i, ['episode']],
  [/\b(\d{1,3}) из (\d+)/i, ['episode']],
  [/ - (\d{1,3})\b/i, ['episode']],
  [/\[(\d{1,3})\]/i, ['episode']],
  [/(\d+) сер/i, ['episode']],
];

const FOLDER_PATTERNS: Array<[RegExp, 'season']> = [
  [/season (\d+)/i, 'season'],
  [/сезон (\d+)/i, 'season'],
  [/(\d+) season/i, 'season'],
  [/(\d+) сезон/i, 'season'],
  [/\bs(\d+)\b/i, 'season'],
];

const naturalCollator = (typeof Intl !== 'undefined' && typeof Intl.Collator === 'function')
  ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  : null;

/**
 * Resolves a file's position within the torrent's complete file list, which is the
 * index TorrPlay's stream and preload routes address files by. Matches by object
 * identity first, so callers holding an entry of that list stay correct when a
 * torrent repeats a path or omits one; the path comparison is the fallback for
 * callers passing a reconstructed file. Returns -1 when the file has no match.
 * Callers must never substitute a position taken from a filtered or sorted subset,
 * since those drop and reorder entries relative to the torrent.
 */
export function resolveFileIndex(
  torrentFiles: Array<{ path: string }>,
  file: { path: string }
): number {
  const identityIndex = torrentFiles.indexOf(file);
  if (identityIndex >= 0) return identityIndex;
  return torrentFiles.findIndex(candidate => candidate.path === file.path);
}

/**
 * Natural hierarchical sort for torrent files adhering to the Unicode Collation Algorithm (UCA).
 * Compares directory segments hierarchically and compares numeric sequences as mathematical integers,
 * supporting arbitrary digit lengths (e.g., E1, E2, ... E10, 9999, 10000) and case-insensitive paths.
 */
export function sortTorrentFiles<T extends { name?: string, path?: string }>(files: T[]): T[] {
  return [...files].sort((fileA, fileB) => {
    const rawPathA = fileA.path || fileA.name || '';
    const rawPathB = fileB.path || fileB.name || '';

    const segmentsA = rawPathA.split(/[\\/]/);
    const segmentsB = rawPathB.split(/[\\/]/);
    const minLength = Math.min(segmentsA.length, segmentsB.length);

    for (let segmentIndex = 0; segmentIndex < minLength; segmentIndex++) {
      const segA = segmentsA[segmentIndex];
      const segB = segmentsB[segmentIndex];
      if (segA !== segB) {
        if (naturalCollator) {
          const comparison = naturalCollator.compare(segA, segB);
          if (comparison !== 0) return comparison;
        } else {
          try {
            const comparison = segA.localeCompare(segB, undefined, { numeric: true, sensitivity: 'base' });
            if (comparison !== 0) return comparison;
          } catch {
            const comparison = segA.localeCompare(segB);
            if (comparison !== 0) return comparison;
          }
        }
      }
    }

    return segmentsA.length - segmentsB.length;
  });
}

/**
 * Resolves file metadata (season, episode, serial flag) and standard Lampa timeline hash.
 * Matches Lampa's native EpisodeParser and Torserver.parse behavior to align timecodes
 * with Lampa's movie and TV show cards, watch history, and in-player playlist resumes.
 */
export function resolveFileInfo(
  file: { name?: string, path?: string },
  movie?: LampaMovie,
  torrentHash?: string,
  playlist?: LampaPlaylistItem[]
): ParsedFileInfo {
  if (typeof Lampa !== 'undefined' && Lampa.Torserver && typeof Lampa.Torserver.parse === 'function') {
    try {
      const cleanTitle = Lampa.Utils?.clearHtmlTags
        ? Lampa.Utils.clearHtmlTags(file.name || file.path?.split('/').pop() || '')
        : (file.name || file.path?.split('/').pop() || '');
      const parsed = Lampa.Torserver.parse({
        files: playlist || [],
        filename: cleanTitle,
        is_file: false,
        movie: movie || {},
        path: file.path || '',
      });
      if (parsed && (parsed.hash !== undefined || parsed.hash_string)) {
        const hash = parsed.hash !== undefined
          ? parsed.hash
          : (Lampa.Utils?.hash ? Lampa.Utils.hash(parsed.hash_string) : parsed.hash_string);
        return {
          episode: typeof parsed.episode === 'number' ? parsed.episode : null,
          hash,
          season: typeof parsed.season === 'number' ? parsed.season : null,
          serial: Boolean(parsed.serial),
        };
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[TorrPlay] Lampa.Torserver.parse failed, falling back to internal parser:', error);
      }
    }
  }

  const filePath = file.path || file.name || '';
  const parts = filePath.replace(/_/g, ' ').split('/');
  const baseFileName = parts.pop() || '';
  const folder = parts.pop() || '';
  const isSerial = Boolean(movie?.number_of_seasons || movie?.original_name);

  let season: number | null = null;
  let episode: number | null = null;

  for (const [pattern, keys] of EPISODE_PATTERNS) {
    const match = baseFileName.match(pattern);
    if (match) {
      keys.forEach((key, idx) => {
        const val = parseInt(match[idx + 1], 10);
        if (!isNaN(val)) {
          if (key === 'season' && season === null) season = val;
          if (key === 'episode' && episode === null) episode = val;
        }
      });
    }
  }

  if (folder && season === null) {
    for (const [pattern] of FOLDER_PATTERNS) {
      const match = folder.match(pattern);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val)) {
          season = val;
          break;
        }
      }
    }
  }

  if (season === null && isSerial) {
    season = 1;
  }

  if (episode === null && (season !== null || isSerial)) {
    const numMatch = (file.name || baseFileName).replace(/_/g, ' ').trim().match(/^(\d{1,3})\b/i);
    if (numMatch) {
      episode = parseInt(numMatch[1], 10);
    }
  }

  const originalTitle = movie?.original_title || movie?.original_name || movie?.title || movie?.name;
  let hashString: string;

  if (season !== null && episode !== null && originalTitle) {
    const separator = season > 10 ? ':' : '';
    hashString = `${season}${separator}${episode}${originalTitle}`;
  } else if (originalTitle && !isSerial && season === null && episode === null) {
    hashString = originalTitle;
  } else {
    hashString = torrentHash ? `${torrentHash}:${filePath}` : filePath;
  }

  const hash = typeof Lampa !== 'undefined' && Lampa.Utils?.hash
    ? Lampa.Utils.hash(hashString)
    : hashString;

  return {
    episode,
    hash,
    season,
    serial: Boolean(isSerial || (season !== null && episode !== null)),
  };
}
