// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ParserHook } from '../src/providers/parser-hook';
import { ProviderManager } from '../src/providers/provider-manager';

// Mirrors Lampa's own Storage.get(): every read passes through `value || fallback || ''`
// and the strings 'true'/'false' come back as booleans. Tests that assert on toggle
// handling are only meaningful against these exact semantics.
function lampaStorageGet(storageMap: Map<string, any>, key: string, defaultValue: any): any {
  const value = storageMap.get(key) || defaultValue || '';
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}

describe('ParserHook', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();
  const addedSources: any[] = [];
  const removedSources: any[] = [];
  const pushedActivities: any[] = [];
  const startedTorrents: any[] = [];
  const torrentBackHandlers: Array<() => void> = [];
  const storageListeners: Array<(event: { name: string, value: unknown }) => void> = [];
  let originalParserGet: any;

  function installGlobalSearchLampa(): void {
    (globalThis as any).Lampa.Activity = {
      push: (activity: unknown) => pushedActivities.push(activity),
    };
    (globalThis as any).Lampa.Lang = {
      translate: (key: string) => key,
    };
    (globalThis as any).Lampa.Search = {
      addSource: (source: unknown) => addedSources.push(source),
      removeSource: (source: unknown) => removedSources.push(source),
    };
    (globalThis as any).Lampa.Torrent = {
      back: (handler: () => void) => torrentBackHandlers.push(handler),
      start: (element: unknown, params: unknown) => startedTorrents.push({ element, params }),
    };
    (globalThis as any).Lampa.Maker = {
      get: () => class MockCardParser {},
    };
    (globalThis as any).Lampa.Storage = {
      field: (key: string) => lampaStorageGet(storageMap, key, 'false'),
      get: (key: string, defaultValue: any) => lampaStorageGet(storageMap, key, defaultValue),
      listener: {
        follow: (_event: string, callback: (event: { name: string, value: unknown }) => void) => {
          storageListeners.push(callback);
        },
      },
      set: (key: string, value: unknown) => {
        storageMap.set(key, value);
        storageListeners.forEach(callback => callback({ name: key, value }));
      },
    };
  }

  function readNativeGlobalSearch(): boolean {
    return Boolean((globalThis as any).Lampa.Storage.field('parse_in_search'));
  }

  beforeEach(() => {
    storageMap.clear();
    addedSources.length = 0;
    removedSources.length = 0;
    pushedActivities.length = 0;
    startedTorrents.length = 0;
    torrentBackHandlers.length = 0;
    storageListeners.length = 0;
    originalParserGet = (_params: any, onComplete: any) => onComplete({ Results: [{ Title: 'Native Result' }] });

    (globalThis as any).Lampa = {
      Parser: {
        get: originalParserGet,
      },
      Storage: {
        get: (key: string, defaultValue: any) => lampaStorageGet(storageMap, key, defaultValue),
        set: (key: string, value: any) => storageMap.set(key, value),
      },
      Utils: {
        bytesToSize: (bytes: number) => `${bytes} B`,
        hash: (str: string) => `hash:${str}`,
      },
    };

    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();
    (ParserHook as any).activeSearchControllers = new Set();
    (ParserHook as any).globalSearchSource = null;
    (ParserHook as any).isGlobalSearchSourceActive = false;
    (ParserHook as any).isManagingNativeGlobalSearch = false;
    (ParserHook as any).originalParserClear = null;
    (ParserHook as any).originalParserGet = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('falls back to native Parser.get when no providers are configured', () => {
    ParserHook.init();

    let received: any = null;
    Lampa.Parser!.get({ search: 'ubuntu' }, data => { received = data; });

    assert.equal(received.Results[0].Title, 'Native Result');
  });

  it('routes search through the provider pool when at least one provider is enabled', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    storageMap.set('torrents_view', ['hash:Provider Result']);
    globalThis.fetch = async () => new Response(JSON.stringify({
      Results: [{
        Info: { voices: ['LostFilm'] },
        Languages: ['ru', 'en'],
        MagnetUri: 'magnet:?xt=urn:btih:' + 'a'.repeat(40),
        Peers: 4,
        PublishDate: '2024-02-03T04:05:06Z',
        Seeders: 12,
        Size: 1000,
        Title: 'Provider Result',
      }],
    }), { status: 200 });

    ParserHook.init();

    const received: any = await new Promise(resolve => {
      Lampa.Parser!.get({ search: 'ubuntu' }, data => resolve(data));
    });

    assert.equal(received.Results.length, 1);
    assert.equal(received.Results[0].Title, 'Provider Result');
    assert.equal(received.Results[0].Seeders, 12);
    assert.equal(received.Results[0].Peers, 4);
    assert.equal(received.Results[0].MagnetUri, 'magnet:?xt=urn:btih:' + 'a'.repeat(40));
    assert.notEqual(received.Results[0].PublishDate, undefined);
    assert.equal(received.Results[0].PublisTime, Date.parse('2024-02-03T04:05:06Z'));
    assert.equal(received.Results[0].viewed, true);
    assert.deepEqual(received.Results[0].languages, ['ru', 'en']);
    assert.deepEqual(received.Results[0].info.voices, ['LostFilm']);
  });

  it('carries the indexer\'s info hash through for a release that has no magnet', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    const infoHash = 'C'.repeat(40);
    globalThis.fetch = async () => new Response(JSON.stringify({
      Results: [{
        InfoHash: infoHash,
        Link: 'http://jackett.local:9117/dl/tracker/abc.torrent',
        Seeders: 3,
        Title: 'Hash Only Result',
      }],
    }), { status: 200 });

    ParserHook.init();

    const received: any = await new Promise(resolve => {
      Lampa.Parser!.get({ search: 'ubuntu' }, data => resolve(data));
    });

    // Without this the release reaches playback as link-only, and the
    // non-persisting path -- which needs the hash in the request URL -- refuses
    // a torrent the indexer had already identified.
    assert.equal(received.Results[0].InfoHash, infoHash.toLowerCase());
    assert.equal(received.Results[0].MagnetUri, '');
    assert.equal(received.Results[0].Link, 'http://jackett.local:9117/dl/tracker/abc.torrent');
    // `hash` stays the title hash: it identifies the card for the viewed list,
    // not the torrent, and Lampa's stored `torrents_view` entries are keyed on it.
    assert.equal(received.Results[0].hash, 'hash:Hash Only Result');
  });

  it('forwards Lampa movie context to provider search', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    let requestedUrl = '';
    globalThis.fetch = async input => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ Results: [] }), { status: 200 });
    };

    ParserHook.init();
    await new Promise<void>(resolve => {
      Lampa.Parser!.get({
        movie: {
          genres: [{ id: 16, name: 'Animation' }],
          first_air_date: '2023-10-01',
          number_of_seasons: 1,
          original_language: 'ja',
          original_name: 'Original Show',
          title: 'Localized Show',
        },
        search: 'show',
      }, () => resolve());
    });

    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get('Category[]'), '5000,5070');
    assert.equal(url.searchParams.get('is_serial'), '2');
    assert.equal(url.searchParams.get('year'), '2023');
  });

  it('never leaves a field Lampa\'s card/list templates render as undefined, even from a bare-minimum upstream result', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    // Only the one truly required field (Title) is present upstream — everything
    // else (Peers, PublishDate, Tracker, MagnetUri, size, Seeders, ...) is omitted,
    // as a provider legitimately might.
    globalThis.fetch = async () => new Response(JSON.stringify({
      Results: [{ Title: 'Bare Minimum Result' }],
    }), { status: 200 });

    ParserHook.init();

    const received: any = await new Promise(resolve => {
      Lampa.Parser!.get({ search: 'ubuntu' }, data => resolve(data));
    });

    const item = received.Results[0];
    // Every field Lampa's card_parser.js / torrent-item templates interpolate
    // directly ({Title}, {Seeders}, {Peers}, {size}) must never be undefined —
    // an undefined value renders as the literal string "undefined" in the UI.
    for (const field of ['Title', 'Seeders', 'Peers', 'size', 'MagnetUri', 'PublishDate', 'Tracker', 'hash', 'source_rank', 'checked_at']) {
      assert.notEqual(item[field], undefined, `${field} must not be undefined`);
    }
  });

  it('falls back to native Parser.get when TorrPlay is disabled', () => {
    storageMap.set('torrplay_enabled', 'false');
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();

    let received: any = null;
    Lampa.Parser!.get({ search: 'ubuntu' }, data => { received = data; });

    assert.equal(received.Results[0].Title, 'Native Result');
  });

  it('reports an aggregate provider failure through Lampa\'s error callback', async () => {
    ProviderManager.addProvider({
      apiKey: 'bad', id: 'p1', isEnabled: true, name: 'Unauthorized', type: 'jackett', url: 'http://jackett.local:9117',
    });
    globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });

    ParserHook.init();
    const receivedError = await new Promise(resolve => {
      Lampa.Parser!.get({ search: 'ubuntu' }, () => resolve('unexpected success'), resolve);
    });

    assert.match(String(receivedError), /Unauthorized: HTTP 401/);
  });

  it('aborts active provider requests when Lampa clears the parser', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });
    let wasAborted = false;
    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        wasAborted = true;
        reject(new Error('aborted'));
      });
    });

    let wasCompleted = false;
    let wasErrored = false;
    ParserHook.init();
    Lampa.Parser!.get(
      { search: 'ubuntu' },
      () => { wasCompleted = true; },
      () => { wasErrored = true; }
    );
    await new Promise(resolve => setImmediate(resolve));
    Lampa.Parser!.clear?.();
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(wasAborted, true);
    assert.equal(wasCompleted, false);
    assert.equal(wasErrored, false);
  });

  it('replaces the native global-search source and restores it when TorrPlay is disabled', async () => {
    storageMap.set('parse_in_search', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });
    globalThis.fetch = async () => new Response(JSON.stringify({
      Results: [{ Seeders: 4, Title: 'Global Provider Result' }],
    }), { status: 200 });

    ParserHook.init();

    assert.equal(storageMap.get('parse_in_search'), 'false');
    assert.equal(storageMap.get('torrplay_search_in_global'), 'true');
    assert.equal(addedSources.length, 1);

    const globalResults: any = await new Promise(resolve => {
      (addedSources[0] as any).search({ query: encodeURIComponent('global query') }, resolve);
    });
    assert.equal(globalResults[0].results[0].Title, 'Global Provider Result');

    Lampa.Storage.set('torrplay_enabled', 'false');

    assert.equal(removedSources.length, 1);
    assert.equal(removedSources[0], addedSources[0]);
    assert.equal(storageMap.get('parse_in_search'), 'true');
  });
  it('does not deliver results from providers that answered before the search was cleared', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'fast', isEnabled: true, name: 'Fast', type: 'jackett', url: 'http://fast.local:9117',
    });
    ProviderManager.addProvider({
      apiKey: 'k', id: 'slow', isEnabled: true, name: 'Slow', type: 'jackett', url: 'http://slow.local:9117',
    });
    globalThis.fetch = async (input, init) => {
      if (String(input).includes('fast.local')) {
        return new Response(JSON.stringify({ Results: [{ Seeders: 9, Title: 'Early Result' }] }), { status: 200 });
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    };

    let wasCompleted = false;
    let wasErrored = false;
    ParserHook.init();
    Lampa.Parser!.get(
      { search: 'ubuntu' },
      () => { wasCompleted = true; },
      () => { wasErrored = true; }
    );
    await new Promise(resolve => setImmediate(resolve));
    Lampa.Parser!.clear?.();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(wasCompleted, false);
    assert.equal(wasErrored, false);
  });

  it('settles the global-search tab when the parser is cleared mid-search', async () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });
    globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });

    ParserHook.init();
    assert.equal(addedSources.length, 1);

    const completion = new Promise(resolve => {
      addedSources[0].search({ query: encodeURIComponent('ubuntu') }, resolve);
    });
    await new Promise(resolve => setImmediate(resolve));
    Lampa.Parser!.clear?.();

    assert.deepEqual(await completion, []);
  });

  it('adopts the native global-search preference on first run', () => {
    storageMap.set('parse_in_search', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();

    assert.equal(storageMap.get('torrplay_search_in_global'), 'true');
    assert.equal(addedSources.length, 1);
  });

  it('mirrors the native global-search toggle being switched off', () => {
    storageMap.set('parse_in_search', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();
    assert.equal(addedSources.length, 1);

    Lampa.Storage.set('parse_in_search', 'false');

    assert.equal(storageMap.get('torrplay_search_in_global'), 'false');
    assert.equal(removedSources.length, 1);
  });
  it('opens the torrents activity when the global-search row asks for more', async () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();

    let wasClosed = false;
    addedSources[0].onMore({ query: 'ubuntu' }, () => { wasClosed = true; });

    // The search overlay has to be dismissed before pushing, otherwise Lampa stacks the
    // new activity behind it.
    assert.equal(wasClosed, true);
    assert.equal(pushedActivities.length, 1);
    assert.equal(pushedActivities[0].component, 'torrents');
    assert.equal(pushedActivities[0].search, 'ubuntu');
    assert.equal(pushedActivities[0].from_search, true);
  });

  it('starts the torrent and arms the back handler when a global-search card is selected', async () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();

    let wasToggled = false;
    const element = { MagnetUri: 'magnet:?xt=urn:btih:' + 'b'.repeat(40), Title: 'Selected Result' };
    addedSources[0].onSelect({ element, line: { toggle: () => { wasToggled = true; } } });

    assert.equal(startedTorrents.length, 1);
    assert.equal(startedTorrents[0].element, element);
    assert.equal(startedTorrents[0].params.title, 'Selected Result');
    // Lampa calls the registered handler on back-navigation; it must re-toggle the very
    // line the card came from, so it stays bound to that line.
    assert.equal(torrentBackHandlers.length, 1);
    torrentBackHandlers[0]();
    assert.equal(wasToggled, true);
  });

  it('restores the card factory on results replayed from the global-search cache', async () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();

    // Lampa caches the plain result objects, so the factory added during the live search
    // is gone by the time the cached row is recalled.
    const cachedItem: any = { Seeders: 3, Title: 'Cached Result' };
    addedSources[0].onRecall([{ results: [cachedItem] }]);

    assert.equal(typeof cachedItem.params.createInstance, 'function');
    assert.notEqual(cachedItem.params.createInstance(cachedItem), undefined);
  });

  it('falls back to a generic Lampa.Card when the CardParser maker is unavailable', async () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    class MockCard {
      public constructor(public data: unknown) {}
    }
    delete (globalThis as any).Lampa.Maker;
    (globalThis as any).Lampa.Card = MockCard;
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();

    const cachedItem: any = { Seeders: 3, Title: 'Cached Result' };
    addedSources[0].onRecall([{ results: [cachedItem] }]);

    const card = cachedItem.params.createInstance(cachedItem);
    assert.ok(card instanceof MockCard);
    assert.equal((card as MockCard).data, cachedItem);
  });

  it('restores the native global-search source when the last provider is removed', () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();
    assert.equal(addedSources.length, 1);
    assert.equal(readNativeGlobalSearch(), false);

    ProviderManager.removeProvider('p1');

    assert.equal(removedSources.length, 1);
    assert.equal(removedSources[0], addedSources[0]);
    assert.equal(storageMap.get('parse_in_search'), 'true');
  });

  it('restores the native global-search source when the last provider is disabled', () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    const provider = {
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett' as const, url: 'http://jackett.local:9117',
    };
    ProviderManager.addProvider(provider);

    ParserHook.init();
    assert.equal(addedSources.length, 1);

    ProviderManager.updateProvider({ ...provider, isEnabled: false });

    assert.equal(removedSources.length, 1);
    assert.equal(storageMap.get('parse_in_search'), 'true');
  });

  it('searches on a malformed percent-encoded query instead of throwing', async () => {
    storageMap.set('torrplay_search_in_global', 'true');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    let requestedUrl = '';
    globalThis.fetch = async input => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ Results: [{ Seeders: 2, Title: 'Undecodable Query Result' }] }), { status: 200 });
    };

    ParserHook.init();

    // A truncated escape sequence makes decodeURIComponent throw; the raw text is the
    // best remaining guess at what the user typed.
    const results: any = await new Promise(resolve => {
      addedSources[0].search({ query: 'ubuntu %E0%A4%A' }, resolve);
    });

    assert.equal(results[0].results[0].Title, 'Undecodable Query Result');
    assert.equal(new URL(requestedUrl).searchParams.get('Query'), 'ubuntu %E0%A4%A');
  });

  it('adds and removes the global-search source as its own toggle is flipped', () => {
    storageMap.set('torrplay_search_in_global', 'false');
    installGlobalSearchLampa();
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();
    assert.equal(addedSources.length, 0);
    // Neither source should run: the user turned this one off and the native one was
    // never asked for.
    assert.equal(readNativeGlobalSearch(), false);

    Lampa.Storage.set('torrplay_search_in_global', 'true');
    assert.equal(addedSources.length, 1);
    assert.equal(readNativeGlobalSearch(), false);

    Lampa.Storage.set('torrplay_search_in_global', 'false');
    assert.equal(removedSources.length, 1);
    assert.equal(removedSources[0], addedSources[0]);
    assert.equal(readNativeGlobalSearch(), false);
  });

  it('hands Lampa the media info its torrent rows render', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });
    globalThis.fetch = async () => new Response(JSON.stringify({
      Results: [
        {
          ffprobe: [
            { codec_type: 'video', height: 2160, width: 3840 },
            { channels: 6, codec_type: 'audio', tags: { language: 'rus' } },
          ],
          info: { quality: 2160, voices: ['Дубляж'] },
          Seeders: 7,
          Title: 'Movie 2160p',
        },
      ],
    }), { status: 200 });

    ParserHook.init();
    const data: any = await new Promise(resolve => {
      Lampa.Parser!.get({ search: 'movie' }, resolve);
    });

    const item = data.Results[0];
    assert.equal(item.info.quality, 2160);
    assert.deepEqual(item.info.voices, ['Дубляж']);
    assert.equal(item.ffprobe.length, 2);
    assert.equal(item.ffprobe[0].width, 3840);
    assert.equal(item.ffprobe[1].channels, 6);
  });
});
