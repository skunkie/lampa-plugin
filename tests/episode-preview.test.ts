// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { collectSeasonNumbers, fetchSeasonEpisodes, resolveEpisodePreview } from '../src/engine/episode-preview';
import { ParsedFileInfo } from '../src/types/torrplay';

describe('Episode Preview (TMDB still images for multi-file torrent lists)', () => {
  const originalLampa = (globalThis as any).Lampa;

  beforeEach(() => {
    (globalThis as any).Lampa = {};
  });

  afterEach(() => {
    if (originalLampa) {
      (globalThis as any).Lampa = originalLampa;
    } else {
      delete (globalThis as any).Lampa;
    }
  });

  describe('collectSeasonNumbers', () => {
    it('collects distinct season numbers from serial file infos, skipping non-serial and duplicate entries', () => {
      const fileInfos: ParsedFileInfo[] = [
        { episode: 1, hash: 'a', season: 1, serial: true },
        { episode: 2, hash: 'b', season: 1, serial: true },
        { episode: 1, hash: 'c', season: 2, serial: true },
        { episode: null, hash: 'd', season: null, serial: false },
        { episode: 3, hash: 'e', season: 3, serial: false },
      ];

      assert.deepEqual(collectSeasonNumbers(fileInfos), [1, 2]);
    });

    it('returns an empty array when no file is a parsed serial episode', () => {
      const fileInfos: ParsedFileInfo[] = [
        { episode: null, hash: 'a', season: null, serial: false },
      ];

      assert.deepEqual(collectSeasonNumbers(fileInfos), []);
    });
  });

  describe('fetchSeasonEpisodes', () => {
    it('resolves to an empty object without calling Lampa.Api when the movie has no TMDB id', async () => {
      (globalThis as any).Lampa.Api = {
        seasons: () => { throw new Error('must not be called without a movie id'); },
      };

      const result = await fetchSeasonEpisodes({ title: 'Untitled' } as LampaMovie, [1, 2]);
      assert.deepEqual(result, {});
    });

    it('resolves to an empty object when there are no season numbers to fetch', async () => {
      (globalThis as any).Lampa.Api = {
        seasons: () => { throw new Error('must not be called with no seasons'); },
      };

      const result = await fetchSeasonEpisodes({ id: 42 } as LampaMovie, []);
      assert.deepEqual(result, {});
    });

    it('resolves to an empty object when Lampa.Api is unavailable', async () => {
      const result = await fetchSeasonEpisodes({ id: 42 } as LampaMovie, [1]);
      assert.deepEqual(result, {});
    });

    it('calls Lampa.Api.seasons with the movie and season numbers, resolving with its callback data', async () => {
      let capturedMovie: unknown;
      let capturedSeasons: number[] | undefined;
      (globalThis as any).Lampa.Api = {
        seasons: (tv: unknown, seasonNumbers: number[], onComplete: (data: unknown) => void) => {
          capturedMovie = tv;
          capturedSeasons = seasonNumbers;
          onComplete({ 1: { episodes: [{ episode_number: 1, name: 'Pilot' }] } });
        },
      };

      const movie = { id: 42, number_of_seasons: 3 } as LampaMovie;
      const result = await fetchSeasonEpisodes(movie, [1]);

      assert.equal(capturedMovie, movie);
      assert.deepEqual(capturedSeasons, [1]);
      assert.deepEqual(result, { 1: { episodes: [{ episode_number: 1, name: 'Pilot' }] } });
    });

    it('resolves to an empty object when Lampa.Api.seasons calls back without data', async () => {
      (globalThis as any).Lampa.Api = {
        seasons: (_tv: unknown, _seasonNumbers: number[], onComplete: (data: unknown) => void) => {
          onComplete(undefined);
        },
      };

      const result = await fetchSeasonEpisodes({ id: 42 } as LampaMovie, [1]);
      assert.deepEqual(result, {});
    });

    it('resolves to an empty object when Lampa.Api.seasons throws synchronously', async () => {
      (globalThis as any).Lampa.Api = {
        seasons: () => { throw new Error('season source unavailable'); },
      };

      const result = await fetchSeasonEpisodes({ id: 42 } as LampaMovie, [1]);
      assert.deepEqual(result, {});
    });

    it('stops waiting when Lampa.Api.seasons never calls back', async () => {
      (globalThis as any).Lampa.Api = {
        seasons: () => {},
      };

      const startedAt = Date.now();
      const result = await fetchSeasonEpisodes({ id: 42 } as LampaMovie, [1]);

      assert.deepEqual(result, {});
      assert.ok(Date.now() - startedAt < 2_500);
    });
  });

  describe('resolveEpisodePreview', () => {
    it('returns undefined when the file was not resolved to a season/episode', () => {
      const fileInfo: ParsedFileInfo = { episode: null, hash: 'a', season: null, serial: false };
      assert.equal(resolveEpisodePreview(fileInfo, { 1: { episodes: [] } }), undefined);
    });

    it('returns a serial fallback when no matching episode exists in the fetched season data', () => {
      const fileInfo: ParsedFileInfo = { episode: 5, hash: 'a', season: 1, serial: true };
      const seasonsData = { 1: { episodes: [{ episode_number: 1, name: 'Pilot' }] } };
      assert.deepEqual(resolveEpisodePreview(fileInfo, seasonsData), {
        airDate: '--',
        img: './img/img_broken.svg',
        title: '',
      });
    });

    it('uses the supplied poster when the matching season was never fetched', () => {
      const fileInfo: ParsedFileInfo = { episode: 1, hash: 'a', season: 2, serial: true };
      assert.deepEqual(
        resolveEpisodePreview(
          fileInfo,
          { 1: { episodes: [{ episode_number: 1 }] } },
          'https://example.com/poster.jpg'
        ),
        {
          airDate: '--',
          img: 'https://example.com/poster.jpg',
          title: '',
        }
      );
    });

    it('resolves the episode still image via Lampa.Api.img, name, and formatted air date', () => {
      (globalThis as any).Lampa.Api = {
        img: (path: string) => `https://image.tmdb.org/t/p/w300${path}`,
      };
      (globalThis as any).Lampa.Utils = {
        parseTime: (value: string) => ({ full: `formatted:${value}` }),
      };

      const fileInfo: ParsedFileInfo = { episode: 2, hash: 'a', season: 1, serial: true };
      const seasonsData = {
        1: {
          episodes: [
            { air_date: '2020-01-02', episode_number: 1, name: 'Pilot', still_path: '/pilot.jpg' },
            { air_date: '2020-01-09', episode_number: 2, name: 'Second Episode', still_path: '/second.jpg' },
          ],
        },
      };

      const preview = resolveEpisodePreview(fileInfo, seasonsData);

      assert.deepEqual(preview, {
        airDate: 'formatted:2020-01-09',
        img: 'https://image.tmdb.org/t/p/w300/second.jpg',
        title: 'Second Episode',
      });
    });

    it('falls back to the native broken-image placeholder when the episode has no still image', () => {
      const fileInfo: ParsedFileInfo = { episode: 1, hash: 'a', season: 1, serial: true };
      const seasonsData = { 1: { episodes: [{ episode_number: 1, name: 'Pilot' }] } };

      const preview = resolveEpisodePreview(fileInfo, seasonsData);

      assert.equal(preview?.img, './img/img_broken.svg');
      assert.equal(preview?.title, 'Pilot');
    });

    it('uses the raw air_date string when Lampa.Utils.parseTime is unavailable', () => {
      const fileInfo: ParsedFileInfo = { episode: 1, hash: 'a', season: 1, serial: true };
      const seasonsData = { 1: { episodes: [{ air_date: '2020-01-02', episode_number: 1, name: 'Pilot' }] } };

      const preview = resolveEpisodePreview(fileInfo, seasonsData);

      assert.equal(preview?.airDate, '2020-01-02');
    });
  });
});
