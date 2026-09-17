// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { buildStreamMagnet, extractHashFromMagnet, normalizeInfoHash, TorrPlayApi, TorrPlayApiError } from '../src/api/torrplay';
import { TorrPlayInstance } from '../src/types/torrplay';

describe('TorrPlayApi', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const baseInstance: TorrPlayInstance = {
    id: 'test-node',
    name: 'Test Node',
    url: 'http://127.0.0.1:8090',
    authType: 'none',
  };

  it('measures latency and status during health check', async () => {
    const instance = { ...baseInstance };
    globalThis.fetch = async (input: RequestInfo | URL) => {
      assert.ok(String(input).endsWith('/api/system/health'));
      return new Response(null, { status: 200 });
    };

    const healthResult = await TorrPlayApi.checkHealth(instance);
    assert.equal(healthResult.isOk, true);
    assert.equal(instance.status, 'online');
    assert.ok(typeof instance.latencyMs === 'number' && instance.latencyMs >= 0);
  });

  it('handles offline node during health check', async () => {
    const instance = { ...baseInstance };
    globalThis.fetch = async () => {
      throw new Error('Connection refused');
    };

    const healthResult = await TorrPlayApi.checkHealth(instance);
    assert.equal(healthResult.isOk, false);
    assert.equal(instance.status, 'offline');
    assert.equal(instance.latencyMs, Infinity);
  });

  it('adds torrent via POST /api/v1/torrents', async () => {
    const instance = { ...baseInstance };
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(input).endsWith('/api/v1/torrents'));
      assert.equal(init?.method, 'POST');
      const requestBody = JSON.parse(String(init?.body));
      assert.equal(requestBody.magnet, 'magnet:?xt=urn:btih:0123456789abcdef');
      assert.equal(requestBody.storage, 'memory');

      return new Response(JSON.stringify({
        hash: '0123456789abcdef',
        name: 'Test Movie',
        files: [{ name: 'video.mkv', path: 'video.mkv', length: 1048576 }],
        storage: 'memory',
        total_size: 1048576,
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const torrent = await TorrPlayApi.addTorrent(instance, {
      magnet: 'magnet:?xt=urn:btih:0123456789abcdef',
      storage: 'memory',
    });

    assert.equal(torrent.hash, '0123456789abcdef');
    assert.equal(torrent.files.length, 1);
  });

  it('recovers from 409 Conflict by fetching existing torrent metadata', async () => {
    const instance = { ...baseInstance };
    const torrentHash = '0123456789abcdef0123456789abcdef01234567';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/api/v1/torrents')) {
        return new Response(JSON.stringify({ message: 'torrent already exists' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 409,
          statusText: 'Conflict',
        });
      }

      if (url.endsWith(`/api/v1/torrents/${torrentHash}`)) {
        return new Response(JSON.stringify({
          files: [{ length: 2048576, name: 'movie.mp4', path: 'movie.mp4' }],
          hash: torrentHash,
          name: 'Existing Movie',
          storage: 'memory',
          total_size: 2048576,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    };

    const result = await TorrPlayApi.addTorrent(instance, {
      hash: torrentHash,
      magnet: `magnet:?xt=urn:btih:${torrentHash}&dn=Existing%20Movie`,
      storage: 'memory',
    });

    assert.equal(result.hash, torrentHash);
    assert.equal(result.name, 'Existing Movie');
  });

  it('recovers from 409 Conflict using hash extracted from magnet URI', async () => {
    const instance = { ...baseInstance };
    const torrentHash = '0123456789abcdef0123456789abcdef01234567';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/api/v1/torrents')) {
        return new Response(JSON.stringify({ message: 'torrent already exists' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 409,
          statusText: 'Conflict',
        });
      }

      if (url.endsWith(`/api/v1/torrents/${torrentHash}`)) {
        return new Response(JSON.stringify({
          files: [{ length: 2048576, name: 'movie.mp4', path: 'movie.mp4' }],
          hash: torrentHash,
          name: 'Existing Movie',
          storage: 'memory',
          total_size: 2048576,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    };

    // No explicit hash property, only magnet
    const result = await TorrPlayApi.addTorrent(instance, {
      magnet: `magnet:?xt=urn:btih:${torrentHash}&dn=Existing%20Movie`,
      storage: 'memory',
    });

    assert.equal(result.hash, torrentHash);
    assert.equal(result.name, 'Existing Movie');
  });

  it('getTorrent appends magnet as a query parameter without persisting', async () => {
    const instance = { ...baseInstance };
    const torrentHash = '0123456789abcdef0123456789abcdef01234567';
    const magnetUri = `magnet:?xt=urn:btih:${torrentHash}&dn=Test`;
    let capturedUrl = '';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      assert.equal(init?.method, 'GET');
      return new Response(JSON.stringify({
        files: [{ length: 1048576, name: 'video.mkv', path: 'video.mkv' }],
        hash: torrentHash,
        name: 'Temporary Movie',
        storage: 'memory',
        total_size: 1048576,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    };

    const torrent = await TorrPlayApi.getTorrent(instance, torrentHash, magnetUri);

    assert.equal(capturedUrl, `http://127.0.0.1:8090/api/v1/torrents/${torrentHash}?magnet=${encodeURIComponent(magnetUri)}`);
    assert.equal(torrent.hash, torrentHash);
  });

  it('getTorrent omits the magnet query parameter when none is given', async () => {
    const instance = { ...baseInstance };
    const torrentHash = '0123456789abcdef0123456789abcdef01234567';
    let capturedUrl = '';

    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({
        files: [],
        hash: torrentHash,
        name: 'Existing Movie',
        storage: 'memory',
        total_size: 1048576,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    };

    await TorrPlayApi.getTorrent(instance, torrentHash);

    assert.equal(capturedUrl, `http://127.0.0.1:8090/api/v1/torrents/${torrentHash}`);
  });

  it('extractHashFromMagnet extracts 40-char hex and converts 32-char base32 info hashes', () => {
    const hexHash = '0123456789abcdef0123456789abcdef01234567';
    const magnetHex = `magnet:?xt=urn:btih:${hexHash}&dn=Test`;
    assert.equal(extractHashFromMagnet(magnetHex), hexHash);

    // 32-char base32 test vector (32 characters = 160 bits = 20 bytes)
    const base32Hash = '234567abcdefghijklmnopqrstuvwxyz';
    const magnetBase32 = `magnet:?xt=urn:btih:${base32Hash}&dn=Test`;
    const extracted = extractHashFromMagnet(magnetBase32);
    assert.ok(extracted);
    assert.equal(extracted?.length, 40);

    assert.equal(extractHashFromMagnet(''), null);
    assert.equal(extractHashFromMagnet('invalid-uri'), null);
  });

  it('normalizeInfoHash validates hex, decodes base32, and rejects invalid strings', () => {
    const validHex = '0123456789ABCDEF0123456789ABCDEF01234567';
    assert.equal(normalizeInfoHash(validHex), validHex.toLowerCase());

    const validBase32 = '234567abcdefghijklmnopqrstuvwxyz';
    const decoded = normalizeInfoHash(validBase32);
    assert.ok(decoded);
    assert.equal(decoded?.length, 40);

    // Lampa internal numeric title hashes or invalid hashes
    assert.equal(normalizeInfoHash('2938472948'), null);
    assert.equal(normalizeInfoHash('12345'), null);
    assert.equal(normalizeInfoHash(''), null);
    assert.equal(normalizeInfoHash('   '), null);
    assert.equal(normalizeInfoHash(null), null);
    assert.equal(normalizeInfoHash(undefined), null);
    assert.equal(normalizeInfoHash({}), null);
    assert.equal(normalizeInfoHash('not-a-valid-hex-or-base32-hash-value-1234567890'), null);
  });

  it('addTorrent replaces invalid hash with hash extracted from magnet link', async () => {
    const instance = { ...baseInstance };
    const validHash = '0123456789abcdef0123456789abcdef01234567';
    let capturedBody: { hash?: string, magnet?: string } | undefined;

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as { hash?: string, magnet?: string };
      return new Response(JSON.stringify({
        files: [],
        hash: validHash,
        name: 'Movie with Numeric Hash',
        storage: 'memory',
        total_size: 1000,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 201,
      });
    };

    const torrent = await TorrPlayApi.addTorrent(instance, {
      hash: '2938472948', // Invalid Lampa internal title hash
      magnet: `magnet:?xt=urn:btih:${validHash}&dn=Test`,
      storage: 'memory',
    });

    assert.equal(torrent.hash, validHash);
    // hash in payload must be the valid 40-char hex string, never the invalid numeric hash
    assert.equal(capturedBody?.hash, validHash);
    assert.equal(capturedBody?.magnet, `magnet:?xt=urn:btih:${validHash}&dn=Test`);
  });

  it('manages preload lifecycle (start, get, cancel)', async () => {
    const instance = { ...baseInstance };
    const torrentHash = '0123456789abcdef';
    const magnetUri = `magnet:?xt=urn:btih:${torrentHash}&dn=Test`;
    let capturedPreloadPutBody: { magnet?: string } | undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(input);
      assert.ok(requestUrl.endsWith(`/api/v1/torrents/${torrentHash}/preload`));

      if (init?.method === 'PUT') {
        capturedPreloadPutBody = JSON.parse(init.body as string) as { magnet?: string };
        return new Response(JSON.stringify({
          file_index: 0,
          target_bytes: 52428800,
          completed_bytes: 26214400,
          progress: 50,
          status: 'preloading',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (init?.method === 'GET' || !init?.method) {
        return new Response(JSON.stringify({
          file_index: 0,
          target_bytes: 52428800,
          completed_bytes: 52428800,
          progress: 100,
          status: 'ready',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected request method: ${init?.method}`);
    };

    const initialPreloadResponse = await TorrPlayApi.startPreload(instance, torrentHash, {
      file_index: 0,
      magnet: magnetUri,
    });
    assert.equal(initialPreloadResponse.progress, 50);
    assert.equal(initialPreloadResponse.status, 'preloading');
    assert.equal(capturedPreloadPutBody?.magnet, magnetUri);

    const preloadResponse = await TorrPlayApi.getPreload(instance, torrentHash);
    assert.equal(preloadResponse.progress, 100);
    assert.equal(preloadResponse.status, 'ready');

    await TorrPlayApi.cancelPreload(instance, torrentHash);
  });

  it('constructs stream URLs with playback token', async () => {
    const instance: TorrPlayInstance = {
      ...baseInstance,
      authType: 'basic',
      username: 'admin',
      password: 'password',
      playbackToken: 'play-token-xyz',
      playbackTokenExpiresAtMs: Date.now() + 60000,
    };

    const streamUrl = await TorrPlayApi.getStreamUrl(instance, '0123456789abcdef', { index: 2 });
    assert.ok(streamUrl.includes('/api/v1/stream/0123456789abcdef?index=2'));
    assert.ok(streamUrl.includes('&token=play-token-xyz'));
  });

  it('constructs stream URLs with magnet query parameter', async () => {
    const instance: TorrPlayInstance = { ...baseInstance };

    const streamUrl = await TorrPlayApi.getStreamUrl(instance, '0123456789abcdef', {
      index: 1,
      magnet: 'magnet:?xt=urn:btih:0123456789abcdef&tr=http://tracker.example.com/ann&dn=Test',
    });
    assert.ok(streamUrl.includes('/api/v1/stream/0123456789abcdef?index=1'));
    assert.ok(streamUrl.includes(`&magnet=${encodeURIComponent(
      'magnet:?xt=urn:btih:0123456789abcdef&tr=http://tracker.example.com/ann'
    )}`));
  });

  it('keeps only the exact topic and trackers in a stream URL magnet', () => {
    assert.equal(
      buildStreamMagnet('magnet:?xt=urn:btih:abc&dn=A+Very+Long+Release+Title&tr=http://t.example/ann&xl=123'),
      'magnet:?xt=urn:btih:abc&tr=http://t.example/ann'
    );
    assert.equal(buildStreamMagnet('magnet:?dn=No+Topic&tr=http://t.example/ann'), null);
    assert.equal(
      buildStreamMagnet('magnet:?XT=urn:btih:abc&DN=Title&TR=http://t.example/ann'),
      'magnet:?XT=urn:btih:abc&TR=http://t.example/ann',
      'uppercase parameter keys must be recognised'
    );
    assert.equal(buildStreamMagnet('not-a-magnet'), null);
    assert.equal(buildStreamMagnet(undefined), null);
  });

  it('keeps the stream URL short enough for external players on a long release title', async () => {
    const instance: TorrPlayInstance = { ...baseInstance, url: 'http://armbian.lan:8090' };
    const hash = '5afa61b1f90504a9bdf31f0ed856d84ba4947c7b';
    const releaseTitle = 'Укрытие / Бункер / Silo / Сeзон: 3 / Сeрии: 1-4 из 10 (Майкл Диннер, Арик Авелино) '
      + '[2026, США, фантастика, драма, триллер, SDR, WEB-DL 2160p, 4k] MVO (HDRezka, NewComers, '
      + 'Red Head Sound, LostFilm, TVShows) + VO (Яроцкий) + Original + Sub (Rus, Eng)';
    const magnetUri = `magnet:?xt=urn:btih:${hash.toUpperCase()}`
      + '&tr=http%3A%2F%2Fbt3.t-ru.org%2Fann%3Fmagnet'
      + `&dn=${encodeURIComponent(releaseTitle)}`;

    const streamUrl = await TorrPlayApi.getStreamUrl(instance, hash, { index: 0, magnet: magnetUri });

    assert.ok(!streamUrl.includes('dn'), 'the display name must not reach the stream URL');
    assert.ok(streamUrl.includes('xt%3Durn%3Abtih'), 'the exact topic must survive');
    assert.ok(streamUrl.includes('bt3.t-ru.org'), 'trackers must survive');
    assert.ok(
      streamUrl.length < 300,
      `stream URL should stay compact, got ${streamUrl.length} characters`
    );
  });

  it('fetches torrents list from database via GET /api/v1/torrents', async () => {
    const instance = { ...baseInstance };
    globalThis.fetch = async (input: RequestInfo | URL) => {
      assert.ok(String(input).includes('/api/v1/torrents'));
      return new Response(JSON.stringify({
        total: 1,
        limit: 50,
        offset: 0,
        torrents: [
          {
            hash: '0123456789abcdef',
            name: 'Test Movie',
            title: 'Test Movie 2026',
            storage: 'memory',
            total_size: 2048576,
            files: [{ name: 'test.mkv', path: 'test.mkv', length: 2048576 }],
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const torrentsResponse = await TorrPlayApi.getTorrents(instance);
    assert.equal(torrentsResponse.total, 1);
    assert.equal(torrentsResponse.torrents.length, 1);
    assert.equal(torrentsResponse.torrents[0].hash, '0123456789abcdef');
    assert.equal(torrentsResponse.torrents[0].title, 'Test Movie 2026');
  });

  it('deletes torrent from database via DELETE /api/v1/torrents/{hash}', async () => {
    const instance = { ...baseInstance };
    let methodCalled = '';
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(input).endsWith('/api/v1/torrents/0123456789abcdef'));
      methodCalled = init?.method || '';
      return new Response(null, { status: 204 });
    };

    await TorrPlayApi.deleteTorrent(instance, '0123456789abcdef');
    assert.equal(methodCalled, 'DELETE');
  });

  it('updates torrent storage via PATCH /api/v1/torrents/{hash}', async () => {
    const instance = { ...baseInstance };
    let methodCalled = '';
    let bodySent = '';
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(input).endsWith('/api/v1/torrents/0123456789abcdef'));
      methodCalled = init?.method || '';
      bodySent = String(init?.body || '');
      return new Response(JSON.stringify({
        hash: '0123456789abcdef',
        name: 'Test Movie',
        storage: 'file',
        total_size: 2048576,
        files: [{ name: 'test.mkv', path: 'test.mkv', length: 2048576 }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const updatedTorrent = await TorrPlayApi.updateTorrent(instance, '0123456789abcdef', { storage: 'file' });
    assert.equal(methodCalled, 'PATCH');
    assert.equal(bodySent, JSON.stringify({ storage: 'file' }));
    assert.equal(updatedTorrent.storage, 'file');
  });

  it('retrieves instance settings via GET /api/v1/settings', async () => {
    const instance = { ...baseInstance };
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(input).endsWith('/api/v1/settings'));
      assert.equal(init?.method || 'GET', 'GET');
      return new Response(JSON.stringify({
        enable_dlna: false,
        enable_downloader: true,
        file_storage_path: '/media/torrents',
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    };

    const settings = await TorrPlayApi.getSettings(instance);
    assert.equal(settings.enable_downloader, true);
    assert.equal(settings.file_storage_path, '/media/torrents');
  });

  it('updates instance settings via PATCH /api/v1/settings', async () => {
    const instance = { ...baseInstance };
    let methodCalled = '';
    let bodySent = '';
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(input).endsWith('/api/v1/settings'));
      methodCalled = init?.method || '';
      bodySent = String(init?.body || '');
      return new Response(null, { status: 204 });
    };

    await TorrPlayApi.updateSettings(instance, { enable_downloader: false, file_storage_path: '/mnt/storage' });
    assert.equal(methodCalled, 'PATCH');
    assert.equal(bodySent, JSON.stringify({ enable_downloader: false, file_storage_path: '/mnt/storage' }));
  });

  it('throws TorrPlayApiError with status on HTTP failure', async () => {
    const instance = { ...baseInstance };
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 });

    await assert.rejects(
      async () => TorrPlayApi.getTorrents(instance),
      (err: unknown) => err instanceof TorrPlayApiError && err.status === 403
    );
  });
});
