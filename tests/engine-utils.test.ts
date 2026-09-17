// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { recordWatchedHistory } from '../src/engine/engine-utils';

describe('recordWatchedHistory', () => {
  const originalLampa = (globalThis as any).Lampa;
  let storageMap: Map<string, any>;

  beforeEach(() => {
    storageMap = new Map();
    (globalThis as any).Lampa = {
      Storage: {
        get: (key: string, fallback: any) => (storageMap.has(key) ? storageMap.get(key) : fallback),
        set: (key: string, value: any) => storageMap.set(key, value),
      },
      Utils: { hash: (value: string) => `#${value}` },
    };
  });

  afterEach(() => {
    (globalThis as any).Lampa = originalLampa;
  });

  it('records a show\'s season and episode under the title its card overlay reads back', () => {
    storageMap.set('online_watched_last', { '#Other': { episode: 2 } });

    recordWatchedHistory(
      { id: 1, number_of_seasons: 2, original_name: 'Show', original_title: 'Show' },
      { episode: 7, season: 1 }
    );

    assert.deepEqual(storageMap.get('online_watched_last'), {
      '#Other': { episode: 2 },
      '#Show': { balanser_name: 'Torrent', episode: 7, season: 1 },
    });
  });

  it('records a show without a season count under its original name', () => {
    recordWatchedHistory({ id: 1, original_name: 'Show' }, { episode: 3, season: 2 });

    assert.deepEqual(storageMap.get('online_watched_last'), {
      '#Show': { balanser_name: 'Torrent', episode: 3, season: 2 },
    });
  });

  it('records only the source for a movie', () => {
    recordWatchedHistory({ id: 1, original_title: 'Film' }, { episode: 0, season: 0 });

    assert.deepEqual(storageMap.get('online_watched_last'), { '#Film': { balanser_name: 'Torrent' } });
  });

  it('leaves history alone for a torrent without a catalog card', () => {
    recordWatchedHistory({ original_title: 'Film' }, { episode: 1, season: 1 });
    recordWatchedHistory({ id: 1 }, { episode: 1, season: 1 });

    assert.equal(storageMap.has('online_watched_last'), false);
  });
});
