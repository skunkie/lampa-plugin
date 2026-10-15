// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { estimatePlaybackFraction, ExternalProgress } from '../src/engine/external-progress';
import { TorrPlayInstance } from '../src/types/torrplay';

const PIECE_BYTES = 16384;

describe('estimatePlaybackFraction', () => {
  it('converts a reader piece into how far through its file it is', () => {
    const estimate = estimatePlaybackFraction(
      [{ length: 100 * PIECE_BYTES, name: 'movie.mkv', path: 'Movie/movie.mkv' }],
      { pieces: [{ index: 0, size: PIECE_BYTES }], readers: [{ end: 48, position: 40, start: 40 }], total_pieces: 100 },
      ['Movie/movie.mkv']
    );

    assert.deepEqual(estimate, { fraction: 0.4, path: 'Movie/movie.mkv' });
  });

  it('lays files out back to back and derives the piece length when no full piece is listed', () => {
    const files = [
      { length: 5000, name: 'info.txt', path: 'Show/info.txt' },
      { length: 50 * PIECE_BYTES, name: 'e01.mkv', path: 'Show/e01.mkv' },
      { length: 50 * PIECE_BYTES, name: 'e02.mkv', path: 'Show/e02.mkv' },
    ];
    const totalBytes = 5000 + 100 * PIECE_BYTES;
    const pieceCount = Math.ceil(totalBytes / PIECE_BYTES);

    const estimate = estimatePlaybackFraction(
      files,
      // Only the short final piece is tracked, which on its own would understate the length.
      { pieces: [{ index: pieceCount - 1, size: 5000 }], readers: [{ end: 80, position: 75, start: 75 }], total_pieces: pieceCount },
      ['Show/e01.mkv', 'Show/e02.mkv']
    );

    assert.ok(estimate);
    assert.equal(estimate.path, 'Show/e02.mkv');
    const e02StartBytes = 5000 + 50 * PIECE_BYTES;
    assert.equal(estimate.fraction, (75 * PIECE_BYTES - e02StartBytes) / (50 * PIECE_BYTES));
  });

  it('uses the piece length the instance reports over any derived one', () => {
    const estimate = estimatePlaybackFraction(
      [{ length: 100 * PIECE_BYTES, name: 'movie.mkv', path: 'movie.mkv' }],
      // A count that alone would imply half this length.
      { readers: [{ end: 0, position: 10, start: 0 }], total_pieces: 100 },
      ['movie.mkv'],
      2 * PIECE_BYTES
    );

    assert.equal(estimate?.fraction, 0.2);
  });

  it('takes the furthest of several readers in the same file', () => {
    const estimate = estimatePlaybackFraction(
      [{ length: 100 * PIECE_BYTES, name: 'movie.mkv', path: 'movie.mkv' }],
      {
        readers: [{ end: 0, position: 10, start: 0 }, { end: 0, position: 60, start: 0 }],
        total_pieces: 100,
      },
      ['movie.mkv']
    );

    assert.equal(estimate?.fraction, 0.6);
  });

  it('makes no estimate when readers sit in more than one of the files', () => {
    const estimate = estimatePlaybackFraction(
      [
        { length: 50 * PIECE_BYTES, name: 'e01.mkv', path: 'e01.mkv' },
        { length: 50 * PIECE_BYTES, name: 'e02.mkv', path: 'e02.mkv' },
      ],
      { readers: [{ end: 0, position: 10, start: 0 }, { end: 0, position: 70, start: 0 }], total_pieces: 100 },
      ['e01.mkv', 'e02.mkv']
    );

    assert.equal(estimate, undefined);
  });

  it('ignores readers outside the played files', () => {
    const estimate = estimatePlaybackFraction(
      [
        { length: 50 * PIECE_BYTES, name: 'e01.mkv', path: 'e01.mkv' },
        { length: 50 * PIECE_BYTES, name: 'e02.mkv', path: 'e02.mkv' },
      ],
      { readers: [{ end: 0, position: 70, start: 0 }], total_pieces: 100 },
      ['e01.mkv']
    );

    assert.equal(estimate, undefined);
  });
});

describe('ExternalProgress', () => {
  const originalFetch = globalThis.fetch;
  const originalLampa = (globalThis as any).Lampa;
  const originalDocument = (globalThis as any).document;
  const originalWindow = (globalThis as any).window;

  const instance: TorrPlayInstance = { authType: 'none', id: 'node', name: 'Node', url: 'http://127.0.0.1:8090' };
  const torrentHash = 'a'.repeat(40);

  let externalListeners: Array<(data: any) => void>;
  let stateListeners: Array<(event: any) => void>;
  let documentListeners: Record<string, () => void>;
  let timelineUpdates: any[];
  let timelines: Record<string, any>;
  let requestedUrls: string[];
  let readerPosition: number;
  let isTorrentActive: boolean;
  let visibilityState: string;

  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
  };

  const armAndLaunch = (movie: any = { runtime: 100 }, files: any[] = [{ hash: 'movie-hash', path: 'movie.mkv' }]) => {
    ExternalProgress.arm({ files, instance, movie, torrentHash });
    externalListeners.forEach(listener => listener({ torrent_hash: torrentHash }));
  };

  const leaveAndReturn = () => {
    visibilityState = 'hidden';
    documentListeners.visibilitychange();
    visibilityState = 'visible';
    documentListeners.visibilitychange();
  };

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
    externalListeners = [];
    stateListeners = [];
    documentListeners = {};
    timelineUpdates = [];
    timelines = {};
    requestedUrls = [];
    readerPosition = 40;
    isTorrentActive = true;
    visibilityState = 'visible';

    (globalThis as any).document = {
      addEventListener: (name: string, listener: () => void) => { documentListeners[name] = listener; },
      get visibilityState() { return visibilityState; },
    };
    (globalThis as any).window = { addEventListener: () => {} };
    (globalThis as any).Lampa = {
      Listener: { follow: (name: string, listener: any) => { if (name === 'state:changed') stateListeners.push(listener); } },
      Player: { listener: { follow: (name: string, listener: any) => { if (name === 'external') externalListeners.push(listener); } } },
      Storage: { get: (_key: string, fallback: any) => fallback, set: () => {} },
      Timeline: {
        update: (view: any) => {
          timelineUpdates.push({ ...view });
          // Lampa announces every timeline update, including the plugin's own.
          stateListeners.forEach(listener => listener({ data: { hash: view.hash }, reason: 'update', target: 'timeline' }));
        },
        view: (hash: string) => ({ duration: 0, hash, percent: 0, time: 0, ...timelines[hash] }),
      },
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes('/api/stats/torrents/')) {
        return new Response(JSON.stringify({
          pieces: [{ index: 0, size: PIECE_BYTES }],
          readers: [{ end: readerPosition, position: readerPosition, start: readerPosition }],
          total_pieces: 100,
        }), { status: 200 });
      }
      assert.ok(url.includes(`/api/v1/torrents?hashes=${torrentHash}`), `unexpected request ${url}`);
      return new Response(JSON.stringify({
        torrents: [{
          active: isTorrentActive,
          files: [{ length: 100 * PIECE_BYTES, name: 'movie.mkv', path: 'movie.mkv' }],
          hash: torrentHash,
          piece_size: PIECE_BYTES,
        }],
      }), { status: 200 });
    };

    ExternalProgress.resetForTesting();
    ExternalProgress.init();
  });

  afterEach(() => {
    ExternalProgress.resetForTesting();
    mock.timers.reset();
    globalThis.fetch = originalFetch;
    (globalThis as any).Lampa = originalLampa;
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it('saves the reader position once the viewer is back from the external player', async () => {
    armAndLaunch();
    leaveAndReturn();

    mock.timers.tick(1999);
    await flush();
    assert.equal(requestedUrls.length, 0, 'measuring must wait for the grace period');

    mock.timers.tick(1);
    await flush();
    assert.deepEqual(timelineUpdates.map(({ duration, hash, percent, time }) => ({ duration, hash, percent, time })), [
      { duration: 6000, hash: 'movie-hash', percent: 40, time: 2400 },
    ]);
  });

  it('measures once for returns that arrive within the same grace period', async () => {
    armAndLaunch();
    leaveAndReturn();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(timelineUpdates.length, 1);
  });

  it('measures again on a later return, so where the player finally stopped wins', async () => {
    readerPosition = 30;
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    readerPosition = 85;
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.deepEqual(timelineUpdates.map(update => update.percent), [30, 85]);
  });

  it('keeps watching for a page that stops running after an earlier measurement', async () => {
    readerPosition = 30;
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    readerPosition = 85;
    mock.timers.setTime(Date.now() + 60_000);
    mock.timers.tick(1000);
    mock.timers.tick(2000);
    await flush();

    assert.deepEqual(timelineUpdates.map(update => update.percent), [30, 85]);
  });

  it('does nothing for playback Lampa never handed to an external player', async () => {
    ExternalProgress.arm({ files: [{ hash: 'movie-hash', path: 'movie.mkv' }], instance, movie: { runtime: 100 }, torrentHash });
    leaveAndReturn();
    mock.timers.tick(5000);
    await flush();

    assert.deepEqual(requestedUrls, []);
  });

  it('ignores an external launch of another torrent', async () => {
    ExternalProgress.arm({ files: [{ hash: 'movie-hash', path: 'movie.mkv' }], instance, movie: { runtime: 100 }, torrentHash });
    externalListeners.forEach(listener => listener({ torrent_hash: 'b'.repeat(40) }));
    leaveAndReturn();
    mock.timers.tick(5000);
    await flush();

    assert.deepEqual(requestedUrls, []);
  });

  it('waits until the viewer has actually left before treating the page as returned to', async () => {
    armAndLaunch();
    documentListeners.visibilitychange();
    mock.timers.tick(5000);
    await flush();

    assert.deepEqual(requestedUrls, []);
  });

  it('keeps an exact position the platform reported for the playlist', async () => {
    armAndLaunch();
    leaveAndReturn();
    stateListeners.forEach(listener => listener({ data: { hash: 'movie-hash' }, reason: 'update', target: 'timeline' }));
    mock.timers.tick(2000);
    await flush();

    assert.deepEqual(requestedUrls, []);
    assert.deepEqual(timelineUpdates, []);
  });

  it('notices the return from a gap in its ticks when the page was not running', async () => {
    armAndLaunch();
    mock.timers.setTime(Date.now() + 60_000);
    mock.timers.tick(1000);
    mock.timers.tick(2000);
    await flush();

    assert.equal(timelineUpdates.length, 1);
  });

  it('waits for the page to be shown when its timers only slowed down while hidden', async () => {
    armAndLaunch();
    visibilityState = 'hidden';
    documentListeners.visibilitychange();
    mock.timers.setTime(Date.now() + 60_000);
    mock.timers.tick(1000);
    mock.timers.tick(5000);
    await flush();
    assert.deepEqual(requestedUrls, [], 'a gap while still hidden is not a return');

    visibilityState = 'visible';
    documentListeners.visibilitychange();
    mock.timers.tick(2000);
    await flush();
    assert.equal(timelineUpdates.length, 1);
  });

  it('stops tracking once the torrent has no reader left', async () => {
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();
    assert.equal(timelineUpdates.length, 1);

    isTorrentActive = false;
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    isTorrentActive = true;
    readerPosition = 10;
    const requestCount = requestedUrls.length;
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(requestedUrls.length, requestCount, 'a later reader belongs to some other playback');
    assert.equal(timelineUpdates.length, 1);
  });

  it('keeps tracking when the viewer returns before the player has opened its stream', async () => {
    isTorrentActive = false;
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();
    assert.deepEqual(timelineUpdates, []);

    isTorrentActive = true;
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(timelineUpdates.length, 1);
  });

  it('stops tracking when the first return comes after the reader has already closed', async () => {
    isTorrentActive = false;
    armAndLaunch();
    mock.timers.setTime(Date.now() + 5 * 60_000);
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    isTorrentActive = true;
    readerPosition = 10;
    const requestCount = requestedUrls.length;
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(requestedUrls.length, requestCount, 'a later reader belongs to some other playback');
    assert.deepEqual(timelineUpdates, []);
  });

  it('leaves a torrent alone once the instance holds no reader for it', async () => {
    isTorrentActive = false;
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(requestedUrls.length, 1);
    assert.ok(!requestedUrls[0].includes('/api/stats/'), 'statistics would load a dropped torrent back');
    assert.deepEqual(timelineUpdates, []);
  });

  it('skips a position too early in the file to count as watched', async () => {
    readerPosition = 1;
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.deepEqual(timelineUpdates, []);
  });

  it('skips a position within the first seconds of a short runtime', async () => {
    readerPosition = 3;
    armAndLaunch({ runtime: 5 });
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.deepEqual(timelineUpdates, [], '3% of five minutes is only nine seconds');
  });

  it('prefers a duration the timeline already knows over the catalog runtime', async () => {
    timelines['movie-hash'] = { duration: 5000 };
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(timelineUpdates[0].duration, 5000);
    assert.equal(timelineUpdates[0].time, 2000);
  });

  it('saves only the percentage when no duration is known', async () => {
    armAndLaunch({});
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(timelineUpdates[0].percent, 40);
    assert.equal(timelineUpdates[0].time, 0);
    assert.equal(timelineUpdates[0].duration, 0);
  });

  it('uses the episode runtime from the season data for an episode', async () => {
    (globalThis as any).Lampa.Api = {
      seasons: (_movie: any, _seasons: number[], onComplete: (data: any) => void) => {
        onComplete({ 1: { episodes: [{ episode_number: 3, runtime: 50 }] } });
      },
    };
    armAndLaunch({ id: 7, number_of_seasons: 1 }, [{ episode: 3, hash: 'episode-hash', path: 'movie.mkv', season: 1 }]);
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.equal(timelineUpdates[0].hash, 'episode-hash');
    assert.equal(timelineUpdates[0].duration, 3000);
    assert.equal(timelineUpdates[0].time, 1200);
  });

  it('gives up quietly when the instance cannot be reached', async () => {
    globalThis.fetch = async () => { throw new TypeError('network error'); };
    armAndLaunch();
    leaveAndReturn();
    mock.timers.tick(2000);
    await flush();

    assert.deepEqual(timelineUpdates, []);
  });
});
