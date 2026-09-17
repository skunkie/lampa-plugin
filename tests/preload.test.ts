// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { PreloadResponse, TorrPlayInstance } from '../src/types/torrplay';
import { PreloadModal } from '../src/ui/preload-modal';

describe('PreloadModal', () => {
  const originalFetch = globalThis.fetch;
  const originalLampa = (globalThis as any).Lampa;

  const testInstance: TorrPlayInstance = {
    authType: 'none',
    id: 'test-inst',
    name: 'Test Node',
    url: 'http://127.0.0.1:8090',
  };

  beforeEach(() => {
    (globalThis as any).Lampa = {
      Loading: {
        setProgress: (_percent: number, _data?: any) => {},
        start: (_onCancel: () => void, _text?: string, _data?: any) => {},
        stop: () => {},
      },
      Utils: {
        bytesToSize: (bytes: number, speed?: boolean) => `${bytes} ${speed ? 'bps' : 'B'}`,
      },
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalLampa) {
      (globalThis as any).Lampa = originalLampa;
    } else {
      delete (globalThis as any).Lampa;
    }
  });

  describe('calculateProgress', () => {
    it('calculates progress from completed_bytes and target_bytes correctly', () => {
      const preloadResponse: PreloadResponse = {
        completed_bytes: 25000000,
        status: 'preloading',
        target_bytes: 50000000,
      };
      assert.equal(PreloadModal.calculateProgress(preloadResponse), 50);

      // Completed equals target -> 100%
      assert.equal(PreloadModal.calculateProgress({
        ...preloadResponse,
        completed_bytes: 50000000,
      }), 100);

      // Completed exceeds target -> capped at 100%
      assert.equal(PreloadModal.calculateProgress({
        ...preloadResponse,
        completed_bytes: 75000000,
      }), 100);
    });

    it('handles decimal progress (0.0 - 1.0) when target_bytes is not available', () => {
      const preloadResponse: PreloadResponse = {
        progress: 0.65,
        status: 'preloading',
      };
      assert.equal(PreloadModal.calculateProgress(preloadResponse), 65);

      assert.equal(PreloadModal.calculateProgress({
        ...preloadResponse,
        progress: 1,
      }), 100);
    });

    it('handles percentage progress (0 - 100) when target_bytes is not available', () => {
      const preloadResponse: PreloadResponse = {
        progress: 42,
        status: 'preloading',
      };
      assert.equal(PreloadModal.calculateProgress(preloadResponse), 42);
    });

    it('supports preloaded_bytes and preload_size aliases', () => {
      const preloadResponse: any = {
        preloaded_bytes: 3000,
        preload_size: 10000,
        status: 'preloading',
      };
      assert.equal(PreloadModal.calculateProgress(preloadResponse), 30);
    });

    it('returns 0 for negative, NaN, or zero values', () => {
      assert.equal(PreloadModal.calculateProgress({ status: 'idle' }), 0);
      assert.equal(PreloadModal.calculateProgress({
        completed_bytes: 0,
        status: 'idle',
        target_bytes: 0,
      }), 0);
      assert.equal(PreloadModal.calculateProgress({
        progress: NaN,
        status: 'idle',
      }), 0);
    });
  });

  describe('waitUntilReady', () => {
    it('treats increasing percentage-only responses as progress for stall detection', async () => {
      const originalDateNow = Date.now;
      const originalSetTimeout = globalThis.setTimeout;
      let currentTimeMs = 0;
      let pollCount = 0;

      Date.now = () => currentTimeMs;
      globalThis.setTimeout = ((callback: (...args: any[]) => void, timeoutMs?: number) => {
        if (timeoutMs === 1000) {
          queueMicrotask(() => callback());
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(callback, timeoutMs);
      }) as typeof setTimeout;

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          currentTimeMs = 31001;
          return new Response(JSON.stringify({
            progress: 0.1,
            status: 'preloading',
          }), { status: 200 });
        }
        pollCount++;
        currentTimeMs += 31001;
        return new Response(JSON.stringify({
          progress: pollCount === 1 ? 0.5 : 1,
          status: pollCount === 1 ? 'preloading' : 'ready',
        }), { status: 200 });
      };

      try {
        const result = await PreloadModal.waitUntilReady(testInstance, 'hash123', { index: 0 });
        assert.equal(result, true);
        assert.equal(pollCount, 2);
      } finally {
        Date.now = originalDateNow;
        globalThis.setTimeout = originalSetTimeout;
      }
    });

    it('keeps waiting through a cold start that reports no progress yet', async () => {
      const originalDateNow = Date.now;
      const originalSetTimeout = globalThis.setTimeout;
      let currentTimeMs = 0;
      let pollCount = 0;

      Date.now = () => currentTimeMs;
      globalThis.setTimeout = ((callback: (...args: any[]) => void, timeoutMs?: number) => {
        if (timeoutMs === 1000) {
          queueMicrotask(() => callback());
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(callback, timeoutMs);
      }) as typeof setTimeout;

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return new Response(JSON.stringify({ status: 'idle' }), { status: 200 });
        }
        pollCount++;
        // A cold torrent: metadata and peer discovery come first, so nothing moves for
        // well past the window a stalled transfer is given.
        currentTimeMs += 10000;
        if (pollCount < 8) {
          return new Response(JSON.stringify({
            preload_size: 1000,
            preloaded_bytes: 0,
            status: 'idle',
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          preload_size: 1000,
          preloaded_bytes: 1000,
          status: 'ready',
        }), { status: 200 });
      };

      try {
        const result = await PreloadModal.waitUntilReady(testInstance, 'hash123', { index: 0 });
        assert.equal(result, true, 'A cold start must not be aborted before any bytes arrive');
        assert.equal(pollCount, 8);
      } finally {
        Date.now = originalDateNow;
        globalThis.setTimeout = originalSetTimeout;
      }
    });

    it('starts the cold-start budget once the preload request itself returns', async () => {
      const originalDateNow = Date.now;
      const originalSetTimeout = globalThis.setTimeout;

      let currentTimeMs = 0;
      Date.now = () => currentTimeMs;
      globalThis.setTimeout = ((callback: (...args: any[]) => void, timeoutMs?: number) => {
        if (timeoutMs === 1000) {
          queueMicrotask(() => callback());
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(callback, timeoutMs);
      }) as typeof setTimeout;

      let pollCount = 0;

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          // The instance spends the whole metadata wait inside this call.
          currentTimeMs += 90000;
          return new Response(JSON.stringify({ status: 'idle' }), { status: 200 });
        }
        if (init?.method === 'DELETE') {
          return new Response(null, { status: 204 });
        }

        pollCount += 1;
        currentTimeMs += 60000;
        // A first poll 60s after the request returned is still inside the opening window;
        // bytes only land on the second one.
        return new Response(JSON.stringify({
          preload_size: 1000,
          preloaded_bytes: pollCount < 2 ? 0 : 1000,
          status: pollCount < 2 ? 'idle' : 'ready',
        }), { status: 200 });
      };

      try {
        const result = await PreloadModal.waitUntilReady(testInstance, 'hash123', { index: 0 });
        assert.equal(
          result,
          true,
          'The metadata wait spent inside the preload request must not consume the opening budget'
        );
      } finally {
        Date.now = originalDateNow;
        globalThis.setTimeout = originalSetTimeout;
      }
    });

    it('gives up on a cold start that never moves and on a transfer that goes quiet', async () => {
      const originalDateNow = Date.now;
      const originalSetTimeout = globalThis.setTimeout;

      Date.now = () => currentTimeMs;
      globalThis.setTimeout = ((callback: (...args: any[]) => void, timeoutMs?: number) => {
        if (timeoutMs === 1000) {
          queueMicrotask(() => callback());
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(callback, timeoutMs);
      }) as typeof setTimeout;

      let currentTimeMs = 0;
      let cancelRequested = false;

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return new Response(JSON.stringify({ status: 'idle' }), { status: 200 });
        }
        if (init?.method === 'DELETE') {
          cancelRequested = true;
          return new Response(null, { status: 204 });
        }
        currentTimeMs += 130000;
        return new Response(JSON.stringify({
          preload_size: 1000,
          preloaded_bytes: 0,
          status: 'idle',
        }), { status: 200 });
      };

      try {
        const coldResult = await PreloadModal.waitUntilReady(testInstance, 'hash123', { index: 0 });
        assert.equal(coldResult, false, 'A cold start that never moves must still be abandoned');
        assert.equal(cancelRequested, true, 'Abandoning the preload must cancel it on the instance');
      } finally {
        Date.now = originalDateNow;
        globalThis.setTimeout = originalSetTimeout;
      }

      Date.now = () => currentTimeMs;
      globalThis.setTimeout = ((callback: (...args: any[]) => void, timeoutMs?: number) => {
        if (timeoutMs === 1000) {
          queueMicrotask(() => callback());
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(callback, timeoutMs);
      }) as typeof setTimeout;

      currentTimeMs = 0;
      cancelRequested = false;
      let pollCount = 0;

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return new Response(JSON.stringify({
            preload_size: 1000,
            preloaded_bytes: 100,
            status: 'preloading',
          }), { status: 200 });
        }
        if (init?.method === 'DELETE') {
          cancelRequested = true;
          return new Response(null, { status: 204 });
        }
        pollCount++;
        // Bytes arrived once, then the transfer went quiet: the tighter window applies.
        currentTimeMs += 31000;
        return new Response(JSON.stringify({
          preload_size: 1000,
          preloaded_bytes: 100,
          status: 'preloading',
        }), { status: 200 });
      };

      try {
        const stalledResult = await PreloadModal.waitUntilReady(testInstance, 'hash123', { index: 0 });
        assert.equal(stalledResult, false, 'A started transfer that goes quiet must be abandoned');
        assert.equal(pollCount, 1, 'The stall window must apply from the first quiet poll');
        assert.equal(cancelRequested, true);
      } finally {
        Date.now = originalDateNow;
        globalThis.setTimeout = originalSetTimeout;
      }
    });

    it('treats increasing preloaded_bytes as progress for stall detection', async () => {
      const originalDateNow = Date.now;
      const originalSetTimeout = globalThis.setTimeout;
      let currentTimeMs = 0;
      let pollCount = 0;

      Date.now = () => currentTimeMs;
      globalThis.setTimeout = ((callback: (...args: any[]) => void, timeoutMs?: number) => {
        if (timeoutMs === 1000) {
          queueMicrotask(() => callback());
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(callback, timeoutMs);
      }) as typeof setTimeout;

      globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          currentTimeMs = 31001;
          return new Response(JSON.stringify({
            preload_size: 1000,
            preloaded_bytes: 100,
            status: 'preloading',
          }), { status: 200 });
        }
        pollCount++;
        return new Response(JSON.stringify({
          preload_size: 1000,
          preloaded_bytes: 1000,
          status: 'ready',
        }), { status: 200 });
      };

      try {
        const result = await PreloadModal.waitUntilReady(testInstance, 'hash123', { index: 0 });
        assert.equal(result, true);
        assert.equal(pollCount, 1);
      } finally {
        Date.now = originalDateNow;
        globalThis.setTimeout = originalSetTimeout;
      }
    });

    it('shows Lampa.Loading, updates progress and speed from PreloadResponse, and resolves true when ready', async () => {
      let isLoadingStarted = false;
      let isLoadingStopped = false;
      let lastProgress = 0;
      let lastStats: any = null;
      let statsRequestMade = false;

      (globalThis as any).Lampa.Loading = {
        setProgress: (percent: number, data?: any) => {
          lastProgress = percent;
          lastStats = data;
        },
        start: (_onCancel: () => void, _text?: string, data?: any) => {
          isLoadingStarted = true;
          assert.equal(data.media.title, 'Sample Movie');
        },
        stop: () => {
          isLoadingStopped = true;
        },
      };

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = String(input);

        if (requestUrl.includes('/api/stats/torrents/')) {
          statsRequestMade = true;
          throw new Error('Preload modal should not poll stats endpoint');
        }

        assert.ok(requestUrl.includes('/api/v1/torrents/hash123/preload'));

        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string);
          assert.equal(body.magnet, 'magnet:?xt=urn:btih:hash123&dn=Sample');
          // startPreload response: initial preloading state with download_rate and peer stats
          return new Response(JSON.stringify({
            active_peers: 3,
            completed_bytes: 10000000,
            connected_seeders: 2,
            download_rate: 1250000,
            status: 'preloading',
            target_bytes: 50000000,
            total_peers: 8,
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
        }

        // On next poll, return ready
        return new Response(JSON.stringify({
          active_peers: 3,
          completed_bytes: 50000000,
          connected_seeders: 2,
          download_rate: 0,
          status: 'ready',
          target_bytes: 50000000,
          total_peers: 8,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      };

      const result = await PreloadModal.waitUntilReady(
        testInstance,
        'hash123',
        { index: 0, magnet: 'magnet:?xt=urn:btih:hash123&dn=Sample', path: 'movie.mkv' },
        { title: 'Sample Movie' }
      );

      assert.equal(result, true);
      assert.equal(isLoadingStarted, true);
      assert.equal(isLoadingStopped, true);
      assert.equal(statsRequestMade, false);
      assert.equal(lastProgress, 20); // 10MB of 50MB from initial startPreload
      assert.equal(lastStats.active_peers, 3);
      assert.equal(lastStats.connected_seeders, 2);
      assert.equal(lastStats.download_speed, 1250000);
      assert.equal(lastStats.leechers, 1); // active_peers(3) - connected_seeders(2)
      assert.equal(lastStats.seeders, 2);
      assert.equal(lastStats.total_peers, 8);
      assert.equal(lastStats.speed, `${1250000 * 8} bps`);
    });

    it('cancels preload and resolves false when user cancels loading', async () => {
      let cancelCallback: (() => void) | null = null;
      let isLoadingStopped = false;

      (globalThis as any).Lampa.Loading = {
        setProgress: () => {},
        start: (onCancel: () => void) => {
          cancelCallback = onCancel;
        },
        stop: () => {
          isLoadingStopped = true;
        },
      };

      let isCancelCalled = false;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = String(input);
        assert.ok(requestUrl.includes('/api/v1/torrents/hash123/preload'));
        if (init?.method === 'DELETE') {
          isCancelCalled = true;
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({
          completed_bytes: 1000,
          status: 'preloading',
          target_bytes: 50000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      };

      const promise = PreloadModal.waitUntilReady(
        testInstance,
        'hash123',
        { index: 0 },
        { title: 'Test' }
      );

      // Simulate user cancel
      assert.ok(cancelCallback);
      (cancelCallback as () => void)();

      const result = await promise;
      assert.equal(result, false);
      assert.equal(isCancelCalled, true);
      assert.equal(isLoadingStopped, true);
    });
  });
});
