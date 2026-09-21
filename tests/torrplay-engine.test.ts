// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { TorrPlayApi } from '../src/api/torrplay';
import { displayFileList, playTorrentFile } from '../src/engine/playback-session';
import { TorrPlayEngine } from '../src/engine/torrplay-engine';
import { InstanceManager } from '../src/instances/instance-manager';
import { SAVE_TO_DATABASE_STORAGE_KEY } from '../src/ui/play-dialog';
import {
  PLAYBACK_MODE_STORAGE_KEY,
  PRELOAD_ENABLED_STORAGE_KEY,
  TORRPLAY_ENABLED_STORAGE_KEY,
} from '../src/ui/settings';

describe('TorrPlayEngine', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();
  let lastSelectShow: any = null;
  let lastNoty: string | null = null;

  beforeEach(() => {
    TorrPlayEngine.resetForTesting();
    storageMap.clear();
    lastSelectShow = null;
    lastNoty = null;

    (globalThis as any).Lampa = {
      Storage: {
        get: (k: string, d: any) => (storageMap.has(k) ? storageMap.get(k) : d),
        set: (k: string, v: any) => storageMap.set(k, v),
      },
      Noty: {
        show: (text: string) => {
          lastNoty = text;
        },
      },
      Activity: {
        active: () => null,
        all: () => [],
        push: () => {},
      },
      Select: {
        show: (options: any) => {
          lastSelectShow = options;
        },
      },
      Torrent: {
        open: () => {},
        start: () => {},
      },
      Utils: {
        bytesToSize: (b: number) => `${b} B`,
        clearHtmlTags: (s: string) => s,
        hash: (s: string) => s,
      },
    };

    InstanceManager.init();
    TorrPlayEngine.init();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    TorrPlayEngine.resetForTesting();
  });

  it('reports enabled status based on storage', () => {
    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
    assert.equal(TorrPlayEngine.isEnabled(), true);

    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, false);
    assert.equal(TorrPlayEngine.isEnabled(), false);
  });

  it('reports playback mode based on storage', () => {
    assert.equal(TorrPlayEngine.getPlaybackMode(), 'torrplay');

    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'ask');
    assert.equal(TorrPlayEngine.getPlaybackMode(), 'ask');

    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'context');
    assert.equal(TorrPlayEngine.getPlaybackMode(), 'context');

    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
    assert.equal(TorrPlayEngine.getPlaybackMode(), 'torrplay');
  });

  it('prompts player choice when in ask mode', () => {
    TorrPlayEngine.promptPlayerChoice({ Title: 'Inception' }, { title: 'Inception' });
    assert.ok(lastSelectShow);
    assert.equal(lastSelectShow.items.length, 2);
    assert.equal(lastSelectShow.items[0].action, 'torrplay');
    assert.equal(lastSelectShow.items[1].action, 'default');
  });

  it('saves torrent to database without opening player', async () => {
    let addPayload: any = null;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/v1/torrents')) {
        addPayload = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          hash: 'abc12345',
          name: 'Saved Movie',
          storage: 'memory',
          total_size: 1000,
          files: [],
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 200 });
    };

    const testHash = '0123456789abcdef0123456789abcdef01234567';
    await TorrPlayEngine.saveToDatabase({
      MagnetUri: `magnet:?xt=urn:btih:${testHash}`,
      Title: 'Test Movie',
    });

    assert.ok(addPayload);
    assert.equal(addPayload.hash, testHash);
    assert.equal(addPayload.magnet, `magnet:?xt=urn:btih:${testHash}`);
    assert.ok(lastNoty && lastNoty.includes('added to database'));
  });

  it('passes HTTP torrent download links to the persisting create endpoint', async () => {
    const torrentLink = 'https://jackett.example.com/dl/indexer?id=release';
    let addPayload: any = null;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/system/health')) {
        return new Response(null, { status: 200 });
      }
      if (url.endsWith('/api/v1/torrents') && init?.method === 'POST') {
        addPayload = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          files: [],
          hash: '0123456789abcdef0123456789abcdef01234567',
          name: 'Private Tracker Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    };

    await TorrPlayEngine.saveToDatabase({ Link: torrentLink, Title: 'Private Tracker Movie' });

    assert.equal(addPayload.link, torrentLink);
    assert.equal(addPayload.hash, undefined);
    assert.equal(addPayload.magnet, undefined);
  });

  it('resolves relative movie poster to absolute URL and saves it to database', async () => {
    let addPayload: any = null;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/v1/torrents')) {
        addPayload = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          files: [],
          hash: '0123456789abcdef0123456789abcdef01234567',
          name: 'Saved Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    const validHash = '0123456789abcdef0123456789abcdef01234567';
    await TorrPlayEngine.saveToDatabase(
      {
        MagnetUri: `magnet:?xt=urn:btih:${validHash}`,
        Title: 'Interstellar',
      },
      {
        poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        title: 'Interstellar',
      }
    );

    assert.ok(addPayload);
    assert.equal(addPayload.hash, validHash);
    assert.equal(addPayload.poster, 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg');
  });

  it('resolves movie and poster from active Lampa activity when movie context is missing or jQuery element', async () => {
    let addPayload: any = null;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/v1/torrents')) {
        addPayload = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          files: [],
          hash: '0123456789abcdef0123456789abcdef01234567',
          name: 'Active Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    (globalThis as any).Lampa.Activity.active = () => ({
      component: 'torrents',
      movie: {
        img: 'https://custom-image.org/poster.png',
        title: 'Activity Movie',
      },
    });

    const validHash = '0123456789abcdef0123456789abcdef01234567';
    // Passing a fake jQuery object as movie argument (simulating event.item)
    const fakeJQueryElement = {
      attr: () => '',
      find: () => ({}),
    };
    await TorrPlayEngine.saveToDatabase(
      {
        MagnetUri: `magnet:?xt=urn:btih:${validHash}`,
      },
      fakeJQueryElement
    );

    assert.ok(addPayload);
    assert.equal(addPayload.hash, validHash);
    assert.equal(addPayload.title, 'Activity Movie');
    assert.equal(addPayload.poster, 'https://custom-image.org/poster.png');
  });

  it('delegates to Lampa.Api.img if available for poster resolution', () => {
    (globalThis as any).Lampa.Api = {
      img: (path: string, size: string) => `https://proxy.lampa.app/${size}${path}`,
    };

    const resolved = TorrPlayEngine.resolvePosterUrl(undefined, {
      poster_path: '/custom_path.jpg',
    });

    assert.equal(resolved, 'https://proxy.lampa.app/w500/custom_path.jpg');
    delete (globalThis as any).Lampa.Api;
  });

  it('handles absolute URLs, data URIs, and filters broken images in resolvePosterUrl', () => {
    assert.equal(
      TorrPlayEngine.resolvePosterUrl({ poster: 'https://example.com/poster.jpg' }),
      'https://example.com/poster.jpg'
    );
    assert.equal(
      TorrPlayEngine.resolvePosterUrl({ poster: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }),
      'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    );
    assert.equal(
      TorrPlayEngine.resolvePosterUrl({ poster: '//image.tmdb.org/t/p/w500/abc.jpg' }),
      'https://image.tmdb.org/t/p/w500/abc.jpg'
    );
    // Skips broken image and uses movie poster_path
    assert.equal(
      TorrPlayEngine.resolvePosterUrl(
        { poster: './img/img_broken.svg' },
        { poster_path: '/fallback.jpg' }
      ),
      'https://image.tmdb.org/t/p/w500/fallback.jpg'
    );
  });

  it('ignores numeric Lampa title hash and extracts real hash from magnet URI in saveToDatabase', async () => {
    let addPayload: any = null;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/v1/torrents')) {
        addPayload = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          files: [],
          hash: '0123456789abcdef0123456789abcdef01234567',
          name: 'Saved Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    const validHash = '0123456789abcdef0123456789abcdef01234567';
    await TorrPlayEngine.saveToDatabase({
      MagnetUri: `magnet:?xt=urn:btih:${validHash}&dn=Test`,
      Title: 'Test Movie',
      hash: '2938472948', // Lampa parser generated numeric hash
    });

    assert.ok(addPayload);
    assert.equal(addPayload.hash, validHash);
    assert.equal(addPayload.magnet, `magnet:?xt=urn:btih:${validHash}&dn=Test`);
  });

  it('shows error notification when no supported torrent source is present', async () => {
    let requestMade = false;
    globalThis.fetch = async () => {
      requestMade = true;
      return new Response(null, { status: 200 });
    };

    await TorrPlayEngine.saveToDatabase({
      Link: 'not-a-torrent-source',
      Title: 'Invalid Source',
      hash: '2938472948', // Numeric hash without magnet
    });

    assert.equal(requestMade, false);
    assert.ok(lastNoty && lastNoty.includes('Valid magnet link or info hash is required'));
  });

  it('routes Lampa.Torrent.start directly to TorrPlay startPlayback', () => {
    let startedPlaybackItem: any = null;
    let originalStarted = false;
    const origStartPlayback = TorrPlayEngine.startPlayback;
    const origOriginalStart = (TorrPlayEngine as any).originalTorrentStart;

    TorrPlayEngine.startPlayback = async (item: any) => { startedPlaybackItem = item; };
    (TorrPlayEngine as any).originalTorrentStart = () => { originalStarted = true; };

    try {
      // When disabled, routes to original Lampa.Torrent.start
      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, false);
      (globalThis as any).Lampa.Torrent.start({ title: 'Test' });
      assert.equal(originalStarted, true);
      assert.equal(startedPlaybackItem, null);

      // When enabled, forwards directly to startPlayback
      originalStarted = false;
      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
      (globalThis as any).Lampa.Torrent.start({ title: 'Test Torrent' });
      assert.ok(startedPlaybackItem);
      assert.equal((startedPlaybackItem as any).title, 'Test Torrent');
      assert.equal(originalStarted, false);
    } finally {
      TorrPlayEngine.startPlayback = origStartPlayback;
      (TorrPlayEngine as any).originalTorrentStart = origOriginalStart;
    }
  });

  it('routes Lampa.Torrent.open directly to TorrPlay startPlayback', () => {
    let startedPlaybackItem: any = null;
    let originalOpenedHash = '';
    const origStartPlayback = TorrPlayEngine.startPlayback;
    const origOriginalOpen = (TorrPlayEngine as any).originalTorrentOpen;

    TorrPlayEngine.startPlayback = async (item: any) => { startedPlaybackItem = item; };
    (TorrPlayEngine as any).originalTorrentOpen = (hash: string) => { originalOpenedHash = hash; };

    try {
      const testHash = '0123456789abcdef0123456789abcdef01234567';

      // When disabled, routes to original Lampa.Torrent.open
      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, false);
      (globalThis as any).Lampa.Torrent.open(testHash);
      assert.equal(originalOpenedHash, testHash);
      assert.equal(startedPlaybackItem, null);

      // When enabled, forwards directly to startPlayback
      originalOpenedHash = '';
      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
      (globalThis as any).Lampa.Torrent.open(testHash);
      assert.ok(startedPlaybackItem);
      assert.equal((startedPlaybackItem as any).hash, testHash);
      assert.equal(originalOpenedHash, '');
    } finally {
      TorrPlayEngine.startPlayback = origStartPlayback;
      (TorrPlayEngine as any).originalTorrentOpen = origOriginalOpen;
    }
  });

  it('routes Lampa.Torrent.start and open per configured playback mode', () => {
    let startedPlaybackItem: any = null;
    let originalStarted = false;
    let originalOpenedHash = '';
    let promptedItem: any = null;
    const origStartPlayback = TorrPlayEngine.startPlayback;
    const origPromptPlayerChoice = TorrPlayEngine.promptPlayerChoice;
    const origOriginalStart = (TorrPlayEngine as any).originalTorrentStart;
    const origOriginalOpen = (TorrPlayEngine as any).originalTorrentOpen;

    TorrPlayEngine.startPlayback = async (item: any) => { startedPlaybackItem = item; };
    TorrPlayEngine.promptPlayerChoice = (item: any) => { promptedItem = item; };
    (TorrPlayEngine as any).originalTorrentStart = () => { originalStarted = true; };
    (TorrPlayEngine as any).originalTorrentOpen = (hash: string) => { originalOpenedHash = hash; };

    try {
      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
      const testHash = '0123456789abcdef0123456789abcdef01234567';

      // Manual mode: standard clicks fall through to the native player untouched.
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'context');
      (globalThis as any).Lampa.Torrent.start({ title: 'Test' });
      assert.equal(originalStarted, true);
      assert.equal(startedPlaybackItem, null);
      (globalThis as any).Lampa.Torrent.open(testHash);
      assert.equal(originalOpenedHash, testHash);
      assert.equal(startedPlaybackItem, null);

      // Ask mode: prompts the user to choose between TorrPlay and the default player.
      originalStarted = false;
      originalOpenedHash = '';
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'ask');
      (globalThis as any).Lampa.Torrent.start({ title: 'Test' });
      assert.ok(promptedItem);
      assert.equal(startedPlaybackItem, null);
      promptedItem = null;
      (globalThis as any).Lampa.Torrent.open(testHash);
      assert.ok(promptedItem);
      assert.equal(startedPlaybackItem, null);

      // A session opened via the dedicated TorrPlay button always plays directly, even in Manual/Ask mode.
      promptedItem = null;
      (globalThis as any).Lampa.Torrent.start({ title: 'Test' }, { torrplay: true });
      assert.ok(startedPlaybackItem);
      assert.equal(promptedItem, null);
    } finally {
      TorrPlayEngine.startPlayback = origStartPlayback;
      TorrPlayEngine.promptPlayerChoice = origPromptPlayerChoice;
      (TorrPlayEngine as any).originalTorrentStart = origOriginalStart;
      (TorrPlayEngine as any).originalTorrentOpen = origOriginalOpen;
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
    }
  });

  it('restores the launching controller when modal playback fails', async () => {
    const originalStartPlayback = TorrPlayEngine.startPlayback;
    let activeController = '';
    let isModalClosed = false;

    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'content' }),
      toggle: (name: string) => {
        activeController = name;
      },
    };
    (globalThis as any).Lampa.Modal = {
      close: () => {
        isModalClosed = true;
      },
    };
    (TorrPlayEngine as any).startPlayback = async () => {
      throw new Error('Playback failed');
    };

    try {
      TorrPlayEngine.playTorrentDirect({ title: 'Movie' });
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      (TorrPlayEngine as any).startPlayback = originalStartPlayback;
    }

    assert.equal(isModalClosed, true);
    assert.equal(activeController, 'content');
    assert.equal(lastNoty, 'TorrPlay: Playback failed');
  });

  it('renders multi-file torrents with the native TorrServer file dialog', async () => {
    const capturedHtml: string[] = [];
    let activeController = '';
    let isModalClosed = false;
    let modalOptions: any = null;
    let timelineRenderCount = 0;

    (globalThis as any).$ = (html: string) => {
      capturedHtml.push(html);
      const element: any = {
        append: (_child: any) => element,
        on: (_event: string, _callback: any) => element,
      };
      return element;
    };
    (globalThis as any).Lampa.Controller = {
      toggle: (name: string) => {
        activeController = name;
      },
    };
    (globalThis as any).Lampa.Lang = {
      translate: (key: string) => key === 'title_files' ? 'Files' : key,
    };
    (globalThis as any).Lampa.Modal = {
      close: () => {
        isModalClosed = true;
      },
      open: (options: any) => {
        modalOptions = options;
      },
    };
    (globalThis as any).Lampa.Template = {
      get: (_name: string, data: any) => (globalThis as any).$(`
        <div class="torrent-file selector">
          <div class="torrent-file__title">${data.title}<span class="exe">.${data.exe}</span></div>
          <div class="torrent-file__size">${data.size}</div>
        </div>
      `),
    };
    (globalThis as any).Lampa.Timeline = {
      render: () => {
        timelineRenderCount++;
        return (globalThis as any).$('<div class="time-line"></div>');
      },
      view: (hash: string) => ({ hash }),
    };

    await displayFileList(
      { authType: 'none', id: 'test', name: 'Test Node', url: 'http://127.0.0.1:8090' },
      {
        files: [
          { length: 1000, name: 'episode.01.mkv', path: 'episode.01.mkv' },
          { length: 2000, name: 'episode.02.mp4', path: 'episode.02.mp4' },
        ],
        hash: 'multi123',
        name: 'Series',
        storage: 'memory',
        title: 'Series',
        total_size: 3000,
      }
    );

    assert.ok(modalOptions);
    assert.equal(modalOptions.mask, true);
    assert.equal(modalOptions.size, 'large');
    assert.equal(modalOptions.title, 'Files');
    assert.ok(capturedHtml.some(html => html.includes('class="torrent-files"')));
    assert.equal(capturedHtml.filter(html => html.includes('torrent-file selector')).length, 2);
    assert.equal(capturedHtml.some(html => html.includes('torrplay-file-item')), false);
    assert.equal(capturedHtml.some(html => html.includes('style=')), false);
    assert.equal(timelineRenderCount, 2);

    modalOptions.onBack();
    assert.equal(isModalClosed, true);
    assert.equal(activeController, 'content');
  });

  it('plays single-file torrents directly via Loading screen without opening a modal before preload', async () => {
    let modalOpened = false;
    let loadingStarted = false;
    let playedItem: any = null;
    const providerResultHash = 'provider-result-hash';
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Modal = {
      close: () => {},
      open: () => {
        modalOpened = true;
      },
    };
    (globalThis as any).Lampa.Loading = {
      setProgress: () => {},
      start: () => {
        loadingStarted = true;
      },
      stop: () => {},
    };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => {
        playedItem = item;
      },
      playlist: () => {},
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'single_video.mkv', path: 'single_video.mkv' }],
          hash: testHash,
          name: 'Single Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    const providerResult: LampaTorrentItem = {
      hash: providerResultHash,
      MagnetUri: `magnet:?xt=urn:btih:${testHash}&dn=Single%20Movie`,
      Title: 'Single Movie',
    };
    await TorrPlayEngine.startPlayback(providerResult);

    assert.equal(loadingStarted, true);
    assert.equal(modalOpened, false);
    assert.ok(playedItem);
    assert.equal(playedItem.torrent_hash, testHash);
    assert.equal(playedItem.no_ad, true);
    assert.equal(playedItem.ad, false);
    assert.equal(playedItem.continue_play, true);
    assert.deepEqual(storageMap.get('torrents_view'), [providerResultHash]);
    assert.equal(providerResult.viewed, true);
  });

  it('stops the "adding torrent" loading screen before preload starts its own for single-file torrents', async () => {
    let playedItem: any = null;
    let isLoadingActive = false;
    const loadingCallOrder: string[] = [];
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Modal = { close: () => {}, open: () => {} };
    (globalThis as any).Lampa.Loading = {
      setProgress: () => {},
      start: () => {
        assert.equal(isLoadingActive, false, 'Loading.start must not be called while already active');
        isLoadingActive = true;
        loadingCallOrder.push('start');
      },
      stop: () => {
        isLoadingActive = false;
        loadingCallOrder.push('stop');
      },
    };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => { playedItem = item; },
      playlist: () => {},
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/preload')) {
        return new Response(JSON.stringify({ status: 'ready', completed_bytes: 100, target_bytes: 100 }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'single_video.mkv', path: 'single_video.mkv' }],
          hash: testHash,
          name: 'Single Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    // Preload enabled is the default — do not disable it here.
    await TorrPlayEngine.startPlayback({
      MagnetUri: `magnet:?xt=urn:btih:${testHash}&dn=Single%20Movie`,
      Title: 'Single Movie',
    });

    assert.ok(playedItem);
    assert.deepEqual(loadingCallOrder, ['start', 'stop', 'start', 'stop']);
  });

  it('startPlayback persists via POST /api/v1/torrents when Save to Database is enabled', async () => {
    const testHash = '0123456789abcdef0123456789abcdef01234567';
    let addMethodUsed: string | undefined;

    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Player = { callback: () => {}, play: () => {}, playlist: () => {} };

    storageMap.set(SAVE_TO_DATABASE_STORAGE_KEY, 'true');
    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/torrents')) {
        addMethodUsed = init?.method;
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'video.mkv', path: 'video.mkv' }],
          hash: testHash,
          name: 'Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    await TorrPlayEngine.startPlayback({
      MagnetUri: `magnet:?xt=urn:btih:${testHash}&dn=Movie`,
      Title: 'Movie',
    });

    assert.equal(addMethodUsed, 'POST');
  });

  it('startPlayback persists an HTTP torrent download link when database saving is enabled', async () => {
    const testHash = '0123456789abcdef0123456789abcdef01234567';
    const torrentLink = 'https://prowlarr.example.com/1/download?id=release';
    let addPayload: any = null;

    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'content' }),
      toggle: () => {},
    };
    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Player = { callback: () => {}, play: () => {}, playlist: () => {} };
    storageMap.set(SAVE_TO_DATABASE_STORAGE_KEY, 'true');
    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/system/health')) {
        return new Response(null, { status: 200 });
      }
      if (url.endsWith('/api/v1/torrents') && init?.method === 'POST') {
        addPayload = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'video.mkv', path: 'video.mkv' }],
          hash: testHash,
          name: 'Private Tracker Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    };

    await TorrPlayEngine.startPlayback({ Link: torrentLink, Title: 'Private Tracker Movie' });

    assert.equal(addPayload.link, torrentLink);
    assert.equal(addPayload.hash, undefined);
    assert.equal(addPayload.magnet, undefined);
  });

  it('startPlayback resolves via GET /api/v1/torrents/{hash} without persisting when Save to Database is disabled', async () => {
    const testHash = '0123456789abcdef0123456789abcdef01234567';
    const magnetUri = `magnet:?xt=urn:btih:${testHash}&dn=Movie`;
    let getMethodUsed: string | undefined;
    let requestedUrl = '';

    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Player = { callback: () => {}, play: () => {}, playlist: () => {} };

    storageMap.set(SAVE_TO_DATABASE_STORAGE_KEY, 'false');
    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(`/api/v1/torrents/${testHash}`) && !url.includes('/preload')) {
        getMethodUsed = init?.method;
        requestedUrl = url;
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'video.mkv', path: 'video.mkv' }],
          hash: testHash,
          name: 'Movie',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      assert.ok(!url.endsWith('/api/v1/torrents'), 'must never call POST /api/v1/torrents when Save to Database is disabled');
      return new Response(null, { status: 200 });
    };

    await TorrPlayEngine.startPlayback({
      MagnetUri: magnetUri,
      Title: 'Movie',
    });

    assert.equal(getMethodUsed, 'GET');
    assert.ok(requestedUrl.includes(`magnet=${encodeURIComponent(magnetUri)}`));
  });

  it('restores the caller\'s controller instead of the closed menu when playback cannot start', async () => {
    const toggledControllers: string[] = [];
    (globalThis as any).Lampa.Controller = {
      // A context menu owns the controller by the time its item handler runs.
      enabled: () => ({ name: 'select' }),
      toggle: (name: string) => { toggledControllers.push(name); },
    };
    (globalThis as any).Lampa.Modal = { close: () => {}, open: () => {} };
    storageMap.set(SAVE_TO_DATABASE_STORAGE_KEY, 'false');

    // Neither a magnet, a link, nor an info hash: playback bails out before any request.
    await TorrPlayEngine.startPlayback({ Title: 'Sourceless Torrent' }, undefined, 'content');

    assert.deepEqual(toggledControllers, ['content'], 'the controller passed by the caller must win over the menu\'s own');
    assert.ok(lastNoty && lastNoty.includes('magnet'));

    await TorrPlayEngine.startPlayback({ Title: 'Sourceless Torrent' });

    assert.deepEqual(
      toggledControllers,
      ['content', 'select'],
      'without a caller controller it still falls back to the enabled one'
    );
  });

  it('hands the file list modal back to the controller captured before the caller\'s menu opened', async () => {
    let modalOptions: any = null;
    const toggledControllers: string[] = [];

    (globalThis as any).$ = (_html: string) => {
      const element: any = {
        append: () => element,
        on: () => element,
      };
      return element;
    };
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'select' }),
      toggle: (name: string) => { toggledControllers.push(name); },
    };
    (globalThis as any).Lampa.Lang = {
      translate: (key: string) => key === 'title_files' ? 'Files' : key,
    };
    (globalThis as any).Lampa.Modal = {
      close: () => {},
      open: (options: any) => { modalOptions = options; },
    };
    (globalThis as any).Lampa.Template = {
      get: (_name: string, data: any) => ({
        append: () => {},
        html: `${data.title}.${data.exe}`,
        on: () => {},
      }),
    };

    await displayFileList(
      { authType: 'none', id: 'test', name: 'Test Node', url: 'http://127.0.0.1:8090' },
      {
        files: [
          { length: 1000, name: 'part-1.mp4', path: 'part-1.mp4' },
          { length: 1000, name: 'part-2.mp4', path: 'part-2.mp4' },
        ],
        hash: 'multi-return',
        name: 'Part Series',
        storage: 'memory',
        title: 'Part Series',
        total_size: 2000,
      },
      undefined,
      undefined,
      undefined,
      'content'
    );

    assert.ok(modalOptions);
    modalOptions.onBack();
    assert.deepEqual(toggledControllers, ['content'], 'closing the file list must not focus the menu that opened it');
  });

  it('fails over temporary playback when the selected instance request fails', async () => {
    const testHash = '0123456789abcdef0123456789abcdef01234567';
    const primaryInstance = {
      authType: 'none' as const,
      id: 'primary',
      name: 'Primary',
      url: 'http://primary.example.com',
    };
    const fallbackInstance = {
      authType: 'none' as const,
      id: 'fallback',
      name: 'Fallback',
      url: 'http://fallback.example.com',
    };
    const originalGetBestInstance = InstanceManager.getBestInstance;
    const originalFailover = InstanceManager.failover;
    let playedUrl = '';

    InstanceManager.getBestInstance = async () => primaryInstance;
    InstanceManager.failover = async instance => {
      assert.equal(instance, primaryInstance);
      return fallbackInstance;
    };
    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => { playedUrl = item.url; },
      playlist: () => {},
    };
    storageMap.set(SAVE_TO_DATABASE_STORAGE_KEY, 'false');
    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.startsWith(primaryInstance.url)) {
        return new Response(null, { status: 503 });
      }
      return new Response(JSON.stringify({
        files: [{ length: 1000, name: 'video.mkv', path: 'video.mkv' }],
        hash: testHash,
        name: 'Movie',
        storage: 'memory',
        total_size: 1000,
      }), { status: 200 });
    };

    try {
      await TorrPlayEngine.startPlayback({
        MagnetUri: `magnet:?xt=urn:btih:${testHash}`,
        Title: 'Movie',
      });
      assert.ok(playedUrl.startsWith(fallbackInstance.url));
    } finally {
      InstanceManager.getBestInstance = originalGetBestInstance;
      InstanceManager.failover = originalFailover;
    }
  });

  it('fails over the save action when the selected instance request fails', async () => {
    const testHash = '0123456789abcdef0123456789abcdef01234567';
    const primaryInstance = {
      authType: 'none' as const,
      id: 'primary',
      name: 'Primary',
      url: 'http://primary.example.com',
    };
    const fallbackInstance = {
      authType: 'none' as const,
      id: 'fallback',
      name: 'Fallback',
      url: 'http://fallback.example.com',
    };
    const originalGetBestInstance = InstanceManager.getBestInstance;
    const originalFailover = InstanceManager.failover;
    let fallbackPostCount = 0;

    InstanceManager.getBestInstance = async () => primaryInstance;
    InstanceManager.failover = async () => fallbackInstance;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith(primaryInstance.url)) {
        return new Response(null, { status: 503 });
      }
      if (url.startsWith(fallbackInstance.url) && init?.method === 'POST') fallbackPostCount++;
      return new Response(JSON.stringify({
        files: [],
        hash: testHash,
        name: 'Movie',
        storage: 'memory',
        total_size: 1000,
      }), { status: 201 });
    };

    try {
      await TorrPlayEngine.saveToDatabase({
        MagnetUri: `magnet:?xt=urn:btih:${testHash}`,
        Title: 'Movie',
      });
      assert.equal(fallbackPostCount, 1);
    } finally {
      InstanceManager.getBestInstance = originalGetBestInstance;
      InstanceManager.failover = originalFailover;
    }
  });

  it('tags player item and playlist with continue_play and torrent for native ad exemption', async () => {
    const testHash = '5555555555555555555555555555555555555555';
    let playedItem: any = null;
    let playedPlaylist: any[] = [];
    const callOrder: string[] = [];

    (globalThis as any).Lampa.Loading = {
      setProgress: () => {},
      start: () => {},
      stop: () => {},
    };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => {
        callOrder.push('play');
        playedItem = item;
      },
      playlist: (items: any[]) => {
        callOrder.push('playlist');
        playedPlaylist = items;
      },
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'video.mkv', path: 'video.mkv' }],
          hash: testHash,
          name: 'Video',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    await TorrPlayEngine.startPlayback({
      MagnetUri: `magnet:?xt=urn:btih:${testHash}&dn=Video`,
      Title: 'Video',
    });

    assert.ok(playedItem);
    assert.equal(playedItem.continue_play, true);
    assert.equal(playedItem.torrent, true);
    assert.ok(playedPlaylist.every(item => item.continue_play === true && item.torrent === true));
    assert.deepEqual(callOrder, ['playlist', 'play']);
    assert.doesNotThrow(() => JSON.stringify(playedItem), 'played item must not be circular');
  });

  it('saves played torrent to Lampa.Favorite history and emits onenter event with movie context', async () => {
    let favoriteCard: any = null;
    let favoriteTarget = '';
    let listenerEvent: any = null;
    let playedItem: any = null;
    let playlistItems: any[] = [];
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Favorite = {
      add: (where: string, card: any) => {
        favoriteCard = card;
        favoriteTarget = where;
      },
    };
    (globalThis as any).Lampa.Listener = {
      send: (type: string, data: any) => {
        if (type === 'torrent_file') {
          listenerEvent = data;
        }
      },
    };
    (globalThis as any).Lampa.Loading = {
      setProgress: () => {},
      start: () => {},
      stop: () => {},
    };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => {
        playedItem = item;
      },
      playlist: (items: any[]) => {
        playlistItems = items;
      },
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [{ length: 5000, name: 'movie.mkv', path: 'movie.mkv' }],
          hash: testHash,
          name: 'The Matrix',
          storage: 'memory',
          total_size: 5000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    const movieContext = {
      id: 603,
      original_title: 'The Matrix',
      poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      release_date: '1999-03-30',
      title: 'The Matrix',
    };

    await TorrPlayEngine.startPlayback(
      {
        MagnetUri: `magnet:?xt=urn:btih:${testHash}&dn=The%20Matrix`,
        Title: 'The Matrix',
      },
      movieContext
    );

    assert.equal(favoriteTarget, 'history');
    assert.ok(favoriteCard);
    assert.equal(favoriteCard.id, 603);
    assert.equal(favoriteCard.name, undefined);
    assert.equal(favoriteCard.original_name, undefined);
    assert.equal(favoriteCard.name ? 'tv' : 'movie', 'movie');
    assert.equal(favoriteCard.original_name ? 'tv' : 'movie', 'movie');
    assert.equal(favoriteCard.title, 'The Matrix');
    assert.deepEqual(favoriteCard, movieContext);

    assert.ok(playedItem);
    assert.equal(playedItem.card.id, 603);
    assert.equal(playedItem.first_title, 'The Matrix');
    assert.equal(playedItem.movie.id, 603);
    assert.equal(playedItem.torrent_hash, testHash);

    assert.equal(playlistItems.length, 1);
    assert.equal(playlistItems[0].card.id, 603);
    assert.equal(playlistItems[0].first_title, 'The Matrix');

    assert.ok(listenerEvent);
    assert.equal(listenerEvent.type, 'onenter');
    assert.equal(listenerEvent.params.movie.id, 603);
    assert.equal(listenerEvent.element.card.id, 603);
  });

  it('preserves TV and custom catalog identities in history and the player', async () => {
    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);
    const cards = [
      { first_air_date: '2020-01-01', id: 123, name: 'Show', original_name: 'Original Show', source: 'tmdb' },
      { id: 'custom-123', source: 'custom', title: 'Custom Movie' },
    ];
    for (const card of cards) {
      let savedCard: any;
      let playerCard: any;
      (globalThis as any).Lampa.Favorite = { add: (_where: string, movie: any) => { savedCard = movie; } };
      (globalThis as any).Lampa.Player = {
        callback: () => {},
        play: (item: any) => { playerCard = item.card; },
        playlist: () => {},
      };
      await playTorrentFile(
        { authType: 'none', id: 'test', name: 'Test', url: 'http://localhost:8090' },
        'hash', 0, { title: 'video.mkv' }, [], card
      );
      assert.deepEqual(savedCard, card);
      assert.deepEqual(playerCard, card);
      assert.notEqual(savedCard, card);
      assert.equal(savedCard.name ? 'tv' : 'movie', card.name ? 'tv' : 'movie');
    }
  });

  it('plays standalone torrents without adding unresolvable catalog history entries', async () => {
    let favoriteCard: any = null;
    let favoriteTarget = '';
    let listenerEvent: any = null;
    let playedItem: any = null;
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Favorite = {
      add: (where: string, card: any) => {
        favoriteCard = card;
        favoriteTarget = where;
      },
    };
    (globalThis as any).Lampa.Listener = {
      send: (type: string, data: any) => {
        if (type === 'torrent_file') {
          listenerEvent = data;
        }
      },
    };
    (globalThis as any).Lampa.Loading = {
      setProgress: () => {},
      start: () => {},
      stop: () => {},
    };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => {
        playedItem = item;
      },
      playlist: () => {},
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [{ length: 2000, name: 'standalone.mp4', path: 'standalone.mp4' }],
          hash: testHash,
          name: 'Standalone Video',
          storage: 'memory',
          total_size: 2000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    await TorrPlayEngine.startPlayback({
      MagnetUri: `magnet:?xt=urn:btih:${testHash}&dn=Standalone%20Video`,
      Title: 'Standalone Video',
    });

    assert.equal(favoriteTarget, '');
    assert.equal(favoriteCard, null);

    assert.ok(playedItem);
    assert.equal(playedItem.card.id, undefined);
    assert.equal(playedItem.card.title, 'Standalone Video');
    assert.equal(playedItem.movie.id, undefined);

    assert.ok(listenerEvent);
    assert.equal(listenerEvent.type, 'onenter');
    assert.equal(listenerEvent.params.movie.id, undefined);
  });

  it('unwraps nested movie and card contexts and resolves from activity stack', () => {
    // Direct with id
    assert.deepEqual(
      TorrPlayEngine.resolveMovieContext({ id: 101, title: 'Direct' }),
      { id: 101, title: 'Direct' }
    );

    // Nested in .movie
    assert.deepEqual(
      TorrPlayEngine.resolveMovieContext({ movie: { id: 102, title: 'Nested Movie' } }),
      { id: 102, title: 'Nested Movie' }
    );

    // Nested in .card
    assert.deepEqual(
      TorrPlayEngine.resolveMovieContext({ card: { id: 103, title: 'Nested Card' } }),
      { id: 103, title: 'Nested Card' }
    );

    // From active activity when passed context has no id
    (globalThis as any).Lampa.Activity.active = () => ({
      movie: { id: 201, title: 'Active Activity Movie' },
    });
    assert.deepEqual(
      TorrPlayEngine.resolveMovieContext({ from_search: true }),
      { id: 201, title: 'Active Activity Movie' }
    );

    // From activity stack history when active has no movie
    (globalThis as any).Lampa.Activity.active = () => null;
    (globalThis as any).Lampa.Activity.all = () => [
      { movie: { id: 301, title: 'Stack Movie' } },
      { component: 'search' },
    ];
    assert.deepEqual(
      TorrPlayEngine.resolveMovieContext(),
      { id: 301, title: 'Stack Movie' }
    );

    // Fallback to title/name object if no id anywhere
    (globalThis as any).Lampa.Activity.all = () => [];
    assert.deepEqual(
      TorrPlayEngine.resolveMovieContext({ title: 'Fallback Title' }),
      { title: 'Fallback Title' }
    );
  });

  it('naturally sorts multi-file torrent files by numeric sequence and directory structure', () => {
    const unsortedFiles = [
      { name: 'Show.S01E10.mkv', path: 'Show.S01E10.mkv' },
      { name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
      { name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
      { name: 'Show.S01E20.mkv', path: 'Show.S01E20.mkv' },
      { name: 'Show.S01E03.mkv', path: 'Show.S01E03.mkv' },
    ];

    const sorted = TorrPlayEngine.sortTorrentFiles(unsortedFiles);
    assert.deepEqual(
      sorted.map(f => f.name),
      [
        'Show.S01E01.mkv',
        'Show.S01E02.mkv',
        'Show.S01E03.mkv',
        'Show.S01E10.mkv',
        'Show.S01E20.mkv',
      ]
    );

    const folderFiles = [
      { path: 'Season 2/Episode 1.mkv' },
      { path: 'Season 10/Episode 1.mkv' },
      { path: 'Season 1/Episode 2.mkv' },
      { path: 'Season 1/Episode 1.mkv' },
    ];
    const sortedFolders = TorrPlayEngine.sortTorrentFiles(folderFiles);
    assert.deepEqual(
      sortedFolders.map(f => f.path),
      [
        'Season 1/Episode 1.mkv',
        'Season 1/Episode 2.mkv',
        'Season 2/Episode 1.mkv',
        'Season 10/Episode 1.mkv',
      ]
    );

    const largeNumberFiles = [
      { name: 'clip-10000.mp4' },
      { name: 'clip-9999.mp4' },
      { name: 'clip-2.mp4' },
      { name: 'clip-1.mp4' },
    ];
    const sortedLargeNumbers = TorrPlayEngine.sortTorrentFiles(largeNumberFiles);
    assert.deepEqual(
      sortedLargeNumbers.map(f => f.name),
      [
        'clip-1.mp4',
        'clip-2.mp4',
        'clip-9999.mp4',
        'clip-10000.mp4',
      ]
    );
  });

  it('displays multi-file torrents in natural sorted order and resolves correct file_index', async () => {
    const capturedCards: string[] = [];
    let modalOptions: any = null;

    (globalThis as any).$ = (_html: string) => {
      const element: any = {
        append: (child: any) => {
          if (child && child.html) capturedCards.push(child.html);
          return element;
        },
        on: (_event: string, _callback: any) => element,
      };
      return element;
    };
    (globalThis as any).Lampa.Controller = {
      toggle: () => {},
    };
    (globalThis as any).Lampa.Lang = {
      translate: (key: string) => key === 'title_files' ? 'Files' : key,
    };
    (globalThis as any).Lampa.Modal = {
      close: () => {},
      open: (options: any) => {
        modalOptions = options;
      },
    };
    (globalThis as any).Lampa.Template = {
      get: (_name: string, data: any) => ({
        append: () => {},
        html: `${data.title}.${data.exe}`,
        on: () => {},
      }),
    };

    await displayFileList(
      { authType: 'none', id: 'test', name: 'Test Node', url: 'http://127.0.0.1:8090' },
      {
        files: [
          { length: 1000, name: 'part-10.mp4', path: 'part-10.mp4' },
          { length: 1000, name: 'part-1.mp4', path: 'part-1.mp4' },
          { length: 1000, name: 'part-2.mp4', path: 'part-2.mp4' },
        ],
        hash: 'multi-sort',
        name: 'Part Series',
        storage: 'memory',
        title: 'Part Series',
        total_size: 3000,
      }
    );

    assert.ok(modalOptions);
    assert.deepEqual(capturedCards, [
      'part-1.mp4',
      'part-2.mp4',
      'part-10.mp4',
    ]);
  });

  it('leaves the file list modal open behind the player and refocuses it (instead of the torrent card) when the player exits', async () => {
    let modalOpenCount = 0;
    let modalCloseCount = 0;
    let loadingStopCount = 0;
    let capturedEnterHandler: (() => Promise<void>) | undefined;
    let capturedPlayerExitCallback: (() => void) | undefined;
    let toggledController = '';
    let playedItem: any = null;

    (globalThis as any).$ = (_html: string) => {
      const element: any = {
        append: () => element,
        on: () => element,
      };
      return element;
    };
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'content' }),
      toggle: (name: string) => { toggledController = name; },
    };
    (globalThis as any).Lampa.Lang = {
      translate: (key: string) => key === 'title_files' ? 'Files' : key,
    };
    (globalThis as any).Lampa.Modal = {
      close: () => { modalCloseCount += 1; },
      open: () => { modalOpenCount += 1; },
    };
    (globalThis as any).Lampa.Template = {
      get: () => {
        const element: any = {
          append: () => element,
          on: (event: string, callback: any) => {
            if (event === 'hover:enter') capturedEnterHandler = callback;
            return element;
          },
        };
        return element;
      },
    };
    (globalThis as any).Lampa.Loading = { stop: () => { loadingStopCount++; } };
    (globalThis as any).Lampa.Favorite = { add: () => {} };
    (globalThis as any).Lampa.Player = {
      callback: (cb: () => void) => {
        capturedPlayerExitCallback = cb;
      },
      play: (item: any) => {
        playedItem = item;
      },
      playlist: () => {},
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    await displayFileList(
      { authType: 'none', id: 'test', name: 'Test Node', url: 'http://127.0.0.1:8090' },
      {
        files: [
          { length: 1000, name: 'part-1.mp4', path: 'part-1.mp4' },
          { length: 1000, name: 'part-2.mp4', path: 'part-2.mp4' },
        ],
        hash: 'multi-exit-test',
        name: 'Part Series',
        storage: 'memory',
        title: 'Part Series',
        total_size: 2000,
      }
    );

    assert.equal(modalOpenCount, 1, 'file list modal should open initially');
    assert.ok(capturedEnterHandler, 'hover:enter handler should be registered on each file item');

    await capturedEnterHandler!();
    await new Promise(resolve => setImmediate(resolve));

    assert.ok(playedItem, 'selecting a file should start playback');
    assert.equal(loadingStopCount, 0, 'disabled preloading must not disturb the modal controller through a stale Loading.stop()');
    assert.equal(modalCloseCount, 0, 'selecting a file must NOT close the file list modal (Lampa leaves it open behind the player)');
    assert.ok(capturedPlayerExitCallback, 'a Player.callback exit handler should be registered');

    capturedPlayerExitCallback!();

    assert.equal(modalOpenCount, 1, 'the modal must not be recreated on exit, only refocused');
    assert.equal(toggledController, 'modal', 'player exit must refocus the still-open file list modal, not the torrent card');
  });

  it('reports multi-file playback failures and restores D-pad focus to the file modal', async () => {
    let capturedEnterHandler: (() => void) | undefined;
    let loadingStopCount = 0;
    let toggledController = '';

    (globalThis as any).$ = () => {
      const element: any = {
        append: () => element,
        on: () => element,
      };
      return element;
    };
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'content' }),
      toggle: (name: string) => { toggledController = name; },
    };
    (globalThis as any).Lampa.Lang = { translate: (key: string) => key };
    (globalThis as any).Lampa.Loading = { stop: () => { loadingStopCount++; } };
    (globalThis as any).Lampa.Modal = { open: () => {} };
    (globalThis as any).Lampa.Template = {
      get: () => {
        const element: any = {
          append: () => element,
          on: (event: string, callback: () => void) => {
            if (event === 'hover:enter') capturedEnterHandler = callback;
            return element;
          },
        };
        return element;
      },
    };

    const originalGetStreamUrl = TorrPlayApi.getStreamUrl;
    (TorrPlayApi as any).getStreamUrl = async () => { throw new Error('stream unavailable'); };
    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    try {
      await displayFileList(
        { authType: 'none', id: 'test', name: 'Test Node', url: 'http://127.0.0.1:8090' },
        {
          files: [
            { length: 1, name: 'part-1.mp4', path: 'part-1.mp4' },
            { length: 1, name: 'part-2.mp4', path: 'part-2.mp4' },
          ],
          hash: 'failed-playback',
          name: 'Parts',
          storage: 'memory',
          total_size: 2,
        }
      );

      assert.ok(capturedEnterHandler);
      capturedEnterHandler();
      await new Promise(resolve => setImmediate(resolve));

      assert.equal(loadingStopCount, 1);
      assert.equal(toggledController, 'modal');
      assert.equal(lastNoty, 'TorrPlay: stream unavailable');
    } finally {
      TorrPlayApi.getStreamUrl = originalGetStreamUrl;
    }
  });

  it('renders TV episode files with a TMDB still image, episode name, and air date instead of a plain title row', async () => {
    const templateCalls: Array<{ data: any, name: string }> = [];
    let capturedSeasonsQuery: { movie: any, seasons: number[] } | undefined;

    (globalThis as any).$ = (_html: string) => {
      const element: any = {
        append: () => element,
        find: () => element,
        on: () => element,
      };
      element[0] = {};
      return element;
    };
    (globalThis as any).Lampa.Controller = { enabled: () => ({ name: 'content' }), toggle: () => {} };
    (globalThis as any).Lampa.Lang = { translate: (key: string) => key === 'title_files' ? 'Files' : key };
    (globalThis as any).Lampa.Modal = { close: () => {}, open: () => {} };
    (globalThis as any).Lampa.Template = {
      get: (name: string, data: any) => {
        templateCalls.push({ data, name });
        const element: any = {
          append: () => element,
          find: () => element,
          on: () => element,
        };
        element[0] = {};
        return element;
      },
    };
    (globalThis as any).Lampa.Api = {
      img: (path: string) => `https://image.tmdb.org/t/p/w300${path}`,
      seasons: (movie: any, seasons: number[], onComplete: (data: any) => void) => {
        capturedSeasonsQuery = { movie, seasons };
        onComplete({
          1: {
            episodes: [
              { air_date: '2020-01-02', episode_number: 1, name: 'Pilot', still_path: '/pilot.jpg' },
              { air_date: '2020-01-09', episode_number: 2, name: 'Second Episode', still_path: '/second.jpg' },
            ],
          },
        });
      },
    };
    (globalThis as any).Lampa.Utils = {
      ...(globalThis as any).Lampa.Utils,
      parseTime: (value: string) => ({ full: `formatted:${value}` }),
    };

    await displayFileList(
      { authType: 'none', id: 'test', name: 'Test Node', url: 'http://127.0.0.1:8090' },
      {
        files: [
          { length: 1000, name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
          { length: 1000, name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
        ],
        hash: 'tv-show-hash',
        name: 'Show',
        storage: 'memory',
        title: 'Show',
        total_size: 2000,
      },
      { id: 99, name: 'Show', number_of_seasons: 1, original_name: 'Show' }
    );

    assert.deepEqual(capturedSeasonsQuery?.seasons, [1], 'must fetch the season detected from the parsed episode files');
    assert.equal(templateCalls.length, 2);
    assert.equal(templateCalls[0].name, 'torrent_file_serial');
    assert.equal(templateCalls[0].data.fname, 'Pilot');
    assert.equal(templateCalls[0].data.img, 'https://image.tmdb.org/t/p/w300/pilot.jpg');
    assert.equal(templateCalls[0].data.air_date, 'formatted:2020-01-02');
    assert.equal(templateCalls[1].data.fname, 'Second Episode');
    assert.equal(templateCalls[1].data.img, 'https://image.tmdb.org/t/p/w300/second.jpg');
  });

  it('resolves standard Lampa timeline hash, season, and episode for movies and TV shows', () => {
    // Single movie: hash must match movie.original_title
    const movieInfo = TorrPlayEngine.resolveFileInfo(
      { path: 'Interstellar.2014.1080p.mkv' },
      { original_title: 'Interstellar', title: 'Интерстеллар' },
      'torrent123'
    );
    assert.equal(movieInfo.season, null);
    assert.equal(movieInfo.episode, null);
    assert.equal(movieInfo.serial, false);
    assert.equal(
      movieInfo.hash,
      (globalThis as any).Lampa.Utils.hash('Interstellar')
    );

    // TV show with S02E07 pattern
    const showInfo = TorrPlayEngine.resolveFileInfo(
      { path: 'Season 02/Game.of.Thrones.S02E07.mkv' },
      { number_of_seasons: 8, original_title: 'Game of Thrones' },
      'torrent123'
    );
    assert.equal(showInfo.season, 2);
    assert.equal(showInfo.episode, 7);
    assert.equal(showInfo.serial, true);
    assert.equal(
      showInfo.hash,
      (globalThis as any).Lampa.Utils.hash('27Game of Thrones')
    );

    // TV show with Russian text "1 сезон 12 серия"
    const ruShowInfo = TorrPlayEngine.resolveFileInfo(
      { path: '1 сезон 12 серия.mkv' },
      { original_name: 'Сериал' },
      'torrent123'
    );
    assert.equal(ruShowInfo.season, 1);
    assert.equal(ruShowInfo.episode, 12);
    assert.equal(ruShowInfo.serial, true);
    assert.equal(
      ruShowInfo.hash,
      (globalThis as any).Lampa.Utils.hash('112Сериал')
    );

    // TV show in season folder with numeric episode "Season 3/09.mkv"
    const folderShowInfo = TorrPlayEngine.resolveFileInfo(
      { path: 'Season 3/09.mkv' },
      { number_of_seasons: 5, original_title: 'Show' },
      'torrent123'
    );
    assert.equal(folderShowInfo.season, 3);
    assert.equal(folderShowInfo.episode, 9);
    assert.equal(
      folderShowInfo.hash,
      (globalThis as any).Lampa.Utils.hash('39Show')
    );

    // Season > 10 format uses colon separator (e.g. 11:4)
    const lateSeasonInfo = TorrPlayEngine.resolveFileInfo(
      { path: 'S11E04.mkv' },
      { number_of_seasons: 15, original_title: 'Show' },
      'torrent123'
    );
    assert.equal(lateSeasonInfo.season, 11);
    assert.equal(lateSeasonInfo.episode, 4);
    assert.equal(
      lateSeasonInfo.hash,
      (globalThis as any).Lampa.Utils.hash('11:4Show')
    );

    // Standalone video without movie metadata falls back to torrent hash and path
    const standaloneInfo = TorrPlayEngine.resolveFileInfo(
      { path: 'video.mp4' },
      undefined,
      'standalonehash'
    );
    assert.equal(
      standaloneInfo.hash,
      (globalThis as any).Lampa.Utils.hash('standalonehash:video.mp4')
    );

    // Delegates to Lampa.Torserver.parse when present
    const originalTorserver = (globalThis as any).Lampa.Torserver;
    try {
      (globalThis as any).Lampa.Torserver = {
        parse: () => ({
          episode: 5,
          hash: 777888,
          season: 2,
          serial: true,
        }),
      };
      const nativeParsed = TorrPlayEngine.resolveFileInfo(
        { path: 'dummy.mkv' },
        { original_title: 'Any' },
        'anyhash'
      );
      assert.equal(nativeParsed.hash, 777888);
      assert.equal(nativeParsed.season, 2);
      assert.equal(nativeParsed.episode, 5);
      assert.equal(nativeParsed.serial, true);
    } finally {
      (globalThis as any).Lampa.Torserver = originalTorserver;
    }

    // Falls back gracefully and logs when Lampa.Torserver.parse throws
    try {
      let debugMessage = '';
      const originalDebug = console.debug;
      console.debug = (...args: any[]) => {
        debugMessage = args.join(' ');
      };
      (globalThis as any).Lampa.Torserver = {
        parse: () => {
          throw new Error('Malformed torrent descriptor');
        },
      };

      try {
        const fallbackParsed = TorrPlayEngine.resolveFileInfo(
          { path: 'Season 01/Show.S01E03.mkv' },
          { number_of_seasons: 1, original_title: 'Fallback Show' },
          'anyhash'
        );
        assert.equal(fallbackParsed.season, 1);
        assert.equal(fallbackParsed.episode, 3);
        assert.ok(debugMessage.includes('Lampa.Torserver.parse failed'));
      } finally {
        console.debug = originalDebug;
      }
    } finally {
      (globalThis as any).Lampa.Torserver = originalTorserver;
    }
  });

  it('uses the torrent\'s own poster and title instead of an unrelated active movie when playing from the database browser', async () => {
    let playedItem: any = null;
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Favorite = { add: () => {} };
    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => { playedItem = item; },
      playlist: () => {},
    };
    // Simulate the user having some unrelated movie open elsewhere in the app —
    // this must never bleed into a torrent played directly from the database browser.
    (globalThis as any).Lampa.Activity.active = () => ({
      movie: { id: 999, img: 'https://example.com/unrelated-movie-poster.jpg', title: 'Unrelated Movie' },
    });

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'movie.mkv', path: 'movie.mkv' }],
          hash: testHash,
          name: 'My Saved Torrent',
          poster: 'https://example.com/my-torrent-poster.jpg',
          storage: 'memory',
          title: 'My Saved Torrent',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    // No movie argument passed — matches how the database torrents browser calls this.
    await TorrPlayEngine.startTorrentPlayback({
      files: [{ length: 1000, name: 'movie.mkv', path: 'movie.mkv' }],
      hash: testHash,
      name: 'My Saved Torrent',
      poster: 'https://example.com/my-torrent-poster.jpg',
      storage: 'memory',
      title: 'My Saved Torrent',
      total_size: 1000,
    });

    assert.ok(playedItem);
    assert.equal(playedItem.card.title, 'My Saved Torrent');
    assert.equal(playedItem.card.img, 'https://example.com/my-torrent-poster.jpg');
    assert.notEqual(playedItem.card.title, 'Unrelated Movie');
  });

  it('uses the originating instance when playing an existing database torrent', async () => {
    let playedItem: any = null;
    let getBestInstanceCallCount = 0;
    const testHash = '0123456789abcdef0123456789abcdef01234567';
    const sourceInstance = {
      authType: 'none' as const,
      id: 'database-instance',
      name: 'Database Instance',
      url: 'http://database.example.com',
    };
    const originalGetBestInstance = InstanceManager.getBestInstance;

    InstanceManager.getBestInstance = async () => {
      getBestInstanceCallCount++;
      throw new Error('Must not select a different instance');
    };
    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => { playedItem = item; },
      playlist: () => {},
    };
    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    try {
      await TorrPlayEngine.startTorrentPlayback(
        {
          files: [{ length: 1000, name: 'movie.mkv', path: 'movie.mkv' }],
          hash: testHash,
          name: 'Saved Movie',
          storage: 'memory',
          total_size: 1000,
        },
        0,
        undefined,
        sourceInstance
      );

      assert.equal(getBestInstanceCallCount, 0);
      assert.ok(playedItem.url.startsWith(sourceInstance.url));
    } finally {
      InstanceManager.getBestInstance = originalGetBestInstance;
    }
  });

  it('tolerates Lampa.Modal.close() throwing when no modal is open during single-file playback', async () => {
    let playedItem: any = null;
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Favorite = { add: () => {} };
    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Modal = {
      close: () => {
        throw new TypeError("Cannot read properties of undefined (reading 'destroy')");
      },
      open: () => {},
    };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => { playedItem = item; },
      playlist: () => {},
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [{ length: 1000, name: 'movie.mkv', path: 'movie.mkv' }],
          hash: testHash,
          name: 'My Saved Torrent',
          storage: 'memory',
          total_size: 1000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    await TorrPlayEngine.startTorrentPlayback({
      files: [{ length: 1000, name: 'movie.mkv', path: 'movie.mkv' }],
      hash: testHash,
      name: 'My Saved Torrent',
      storage: 'memory',
      total_size: 1000,
    });

    assert.ok(playedItem, 'playback must complete despite Modal.close() throwing');
  });

  it('propagates timeline, season, and episode to player item and all playlist entries', async () => {
    let playedItem: any = null;
    let playlistItems: any[] = [];
    let listenerEvent: any = null;
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Favorite = {
      add: () => {},
    };
    (globalThis as any).Lampa.Listener = {
      send: (type: string, data: any) => {
        if (type === 'torrent_file') listenerEvent = data;
      },
    };
    (globalThis as any).Lampa.Loading = {
      setProgress: () => {},
      start: () => {},
      stop: () => {},
    };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => {
        playedItem = item;
      },
      playlist: (items: any[]) => {
        playlistItems = items;
      },
    };
    (globalThis as any).Lampa.Timeline = {
      render: () => {},
      view: (hash: any) => ({
        duration: 3600,
        handler: () => {},
        hash,
        percent: 25,
        time: 900,
      }),
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: [
            { length: 5000, name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
            { length: 5000, name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
          ],
          hash: testHash,
          name: 'Show',
          storage: 'memory',
          total_size: 10000,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    const tvContext = {
      id: 500,
      number_of_seasons: 2,
      original_name: 'Test Show',
      original_title: 'Test Show',
      title: 'Test Show',
    };

    await TorrPlayEngine.startTorrentPlayback(
      {
        files: [
          { length: 5000, name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
          { length: 5000, name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
        ],
        hash: testHash,
        name: 'Show',
        storage: 'memory',
        total_size: 10000,
      },
      0,
      tvContext
    );

    // First episode in player
    assert.ok(playedItem);
    assert.equal(playedItem.season, 1);
    assert.equal(playedItem.episode, 1);
    assert.ok(playedItem.timeline);
    assert.equal(
      playedItem.timeline.hash,
      (globalThis as any).Lampa.Utils.hash('11Test Show')
    );

    // Emitted event carries season and episode for WatchedHistory
    assert.ok(listenerEvent);
    assert.equal(listenerEvent.element.season, 1);
    assert.equal(listenerEvent.element.episode, 1);

    // Entire playlist has timeline and episode metadata attached
    assert.equal(playlistItems.length, 2);
    assert.equal(playlistItems[0].season, 1);
    assert.equal(playlistItems[0].episode, 1);
    assert.equal(
      playlistItems[0].timeline.hash,
      (globalThis as any).Lampa.Utils.hash('11Test Show')
    );

    assert.equal(playlistItems[1].season, 1);
    assert.equal(playlistItems[1].episode, 2);
    assert.equal(
      playlistItems[1].timeline.hash,
      (globalThis as any).Lampa.Utils.hash('12Test Show')
    );
  });
  it('selects the player item by matching torrent file_index rather than array position when they diverge', async () => {
    let playedItem: any = null;
    const testHash = '0123456789abcdef0123456789abcdef01234567';

    (globalThis as any).Lampa.Favorite = { add: () => {} };
    (globalThis as any).Lampa.Loading = { setProgress: () => {}, start: () => {}, stop: () => {} };
    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: (item: any) => {
        playedItem = item;
      },
      playlist: () => {},
    };

    // A leading non-video file shifts every video file's real torrent file_index
    // one past its position in the video-only playlist array.
    const torrentFiles = [
      { length: 10, name: 'readme.txt', path: 'readme.txt' },
      { length: 5000, name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
      { length: 5000, name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
    ];

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/torrents')) {
        return new Response(JSON.stringify({
          files: torrentFiles,
          hash: testHash,
          name: 'Show',
          storage: 'memory',
          total_size: 10010,
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        });
      }
      return new Response(null, { status: 200 });
    };

    storageMap.set(PRELOAD_ENABLED_STORAGE_KEY, false);

    // Playlist position 0 (first video file) has real file_index 1, not 0.
    await TorrPlayEngine.startTorrentPlayback(
      { files: torrentFiles, hash: testHash, name: 'Show', storage: 'memory', total_size: 10010 },
      0
    );

    assert.ok(playedItem);
    assert.equal(playedItem.fname, 'Show.S01E01.mkv');
    assert.equal(typeof playedItem.url, 'string');
  });

  it('does not hand non-video torrent files to the player', async () => {
    let playCount = 0;
    const sourceInstance = {
      authType: 'none' as const,
      id: 'database-instance',
      name: 'Database Instance',
      url: 'http://database.example.com',
    };

    (globalThis as any).Lampa.Player = {
      callback: () => {},
      play: () => { playCount++; },
      playlist: () => {},
    };

    await TorrPlayEngine.startTorrentPlayback(
      {
        files: [
          { length: 100, name: 'readme.txt', path: 'readme.txt' },
          { length: 200, name: 'subtitle.srt', path: 'subtitle.srt' },
        ],
        hash: 'non-video-torrent',
        name: 'Non-video Torrent',
        storage: 'memory',
        total_size: 300,
      },
      0,
      undefined,
      sourceInstance
    );

    assert.equal(playCount, 0);
    assert.equal(lastNoty, 'No video files found in torrent');
  });

  it('routes Lampa.Torrent.start and open directly to TorrPlay startPlayback', () => {
    let startedPlaybackItem: any = null;
    let startedPlaybackMovie: any = null;
    const origStartPlayback = TorrPlayEngine.startPlayback;
    TorrPlayEngine.startPlayback = async (item: any, movie?: any) => {
      startedPlaybackItem = item;
      startedPlaybackMovie = movie;
    };

    try {
      TorrPlayEngine.init();

      // start() forwards directly to TorrPlay startPlayback
      (globalThis as any).Lampa.Torrent.start({ Title: 'Fresh Torrent', info_hash: '1111111111111111111111111111111111111111' }, { id: 10 });
      assert.ok(startedPlaybackItem);
      assert.equal((startedPlaybackItem as any).Title, 'Fresh Torrent');
      assert.equal((startedPlaybackMovie as any).id, 10);

      // open() forwards directly to TorrPlay startPlayback
      startedPlaybackItem = null;
      (globalThis as any).Lampa.Torrent.open('2222222222222222222222222222222222222222', { id: 20 });
      assert.ok(startedPlaybackItem);
      assert.equal((startedPlaybackItem as any).hash, '2222222222222222222222222222222222222222');
      assert.equal((startedPlaybackMovie as any).id, 20);
    } finally {
      TorrPlayEngine.startPlayback = origStartPlayback;
      TorrPlayEngine.resetForTesting();
    }
  });
});
