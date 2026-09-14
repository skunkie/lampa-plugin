// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ProviderManager } from '../src/providers/provider-manager';
import { ProviderSearch } from '../src/providers/provider-search';

describe('ProviderSearch', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();

  beforeEach(() => {
    storageMap.clear();
    (globalThis as any).Lampa = {
      Noty: { show: () => {} },
      Storage: {
        get: (key: string, defaultValue: any) => (storageMap.has(key) ? storageMap.get(key) : defaultValue),
        set: (key: string, value: any) => storageMap.set(key, value),
      },
    };
    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns nothing when no providers are enabled', async () => {
    const results = await ProviderSearch.search({ query: 'ubuntu' });
    assert.deepEqual(results, []);
  });

  it('maps Jackett native JSON results into internal search results', async () => {
    ProviderManager.addProvider({
      apiKey: 'jkey', id: 'j1', isEnabled: true, name: 'Home Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    globalThis.fetch = async (input: RequestInfo | URL) => {
      assert.ok(String(input).includes('/api/v2.0/indexers/all/results'));
      assert.ok(String(input).includes('apikey=jkey'));
      return new Response(JSON.stringify({
        Results: [
          {
            Category: [2000],
            Guid: 'guid-1',
            Info: { voices: ['LostFilm'] },
            InfoHash: 'a'.repeat(40),
            Languages: ['ru', 'en'],
            Link: 'http://jackett.local/download/1',
            MagnetUri: 'magnet:?xt=urn:btih:' + 'a'.repeat(40),
            Peers: 17,
            PublishDate: '2024-01-01T00:00:00Z',
            Seeders: 42,
            Size: 123456,
            Title: 'Some.Movie.2024.1080p',
            Tracker: 'RARBG',
          },
        ],
      }), { status: 200 });
    };

    const results = await ProviderSearch.search({ query: 'some movie' });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Some.Movie.2024.1080p');
    assert.equal(results[0].seeders, 42);
    assert.equal(results[0].sizeBytes, 123456);
    assert.equal(results[0].hash, 'a'.repeat(40));
    assert.equal(results[0].leechers, 17);
    assert.equal(results[0].tracker, 'RARBG');
    assert.equal(results[0].providerName, 'Home Jackett');
    assert.deepEqual(results[0].languages, ['ru', 'en']);
    assert.deepEqual(results[0].info?.voices, ['LostFilm']);
  });

  it('maps Prowlarr native JSON results and filters out non-torrent protocols', async () => {
    ProviderManager.addProvider({
      apiKey: 'pkey', id: 'p1', isEnabled: true, name: 'VPS Prowlarr', type: 'prowlarr', url: 'https://prowlarr.example.com',
    });

    globalThis.fetch = async (input: RequestInfo | URL) => {
      assert.ok(String(input).includes('/api/v1/search'));
      return new Response(JSON.stringify([
        {
          downloadUrl: 'magnet:?xt=urn:btih:' + 'b'.repeat(40),
          indexer: 'YTS',
          info: { voices: ['Dub'] },
          languages: ['en'],
          leechers: 9,
          protocol: 'torrent',
          publishDate: '2024-02-02T00:00:00Z',
          seeders: 100,
          size: 999999,
          title: 'Torrent Result',
        },
        {
          protocol: 'usenet',
          title: 'Should Be Filtered Out',
        },
      ]), { status: 200 });
    };

    const results = await ProviderSearch.search({ query: 'torrent result' });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'Torrent Result');
    assert.equal(results[0].tracker, 'YTS');
    assert.equal(results[0].seeders, 100);
    assert.equal(results[0].leechers, 9);
    assert.deepEqual(results[0].languages, ['en']);
    assert.deepEqual(results[0].info?.voices, ['Dub']);
  });

  it('forwards movie metadata and category filtering to Jackett', async () => {
    ProviderManager.addProvider({
      apiKey: 'jkey', id: 'j1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    globalThis.fetch = async input => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('Query'), 'localized title');
      assert.equal(url.searchParams.get('Category[]'), '2000');
      assert.equal(url.searchParams.get('genres'), 'Drama,Crime');
      assert.equal(url.searchParams.get('is_serial'), '1');
      assert.equal(url.searchParams.get('title'), 'Localized Title');
      assert.equal(url.searchParams.get('title_original'), 'Original Title');
      assert.equal(url.searchParams.get('year'), '2025');
      return new Response(JSON.stringify({ Results: [] }), { status: 200 });
    };

    await ProviderSearch.search({
      movie: {
        genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
        originalTitle: 'Original Title',
        releaseDate: '2025-04-12',
        title: 'Localized Title',
      },
      query: 'localized title',
    });
  });

  it('forwards TV and anime filtering to Prowlarr', async () => {
    ProviderManager.addProvider({
      apiKey: 'pkey', id: 'p1', isEnabled: true, name: 'Prowlarr', type: 'prowlarr', url: 'http://prowlarr.local:9696',
    });

    globalThis.fetch = async input => {
      const url = new URL(String(input));
      assert.deepEqual(url.searchParams.getAll('categories'), ['5000', '5070']);
      assert.equal(url.searchParams.get('query'), 'anime show');
      assert.equal(url.searchParams.get('type'), 'tvsearch');
      return new Response(JSON.stringify([]), { status: 200 });
    };

    await ProviderSearch.search({
      movie: {
        genres: [{ id: 16, name: 'Animation' }],
        numberOfSeasons: 2,
        originalLanguage: 'ja',
        originalName: 'Anime Show',
      },
      query: 'anime show',
    });
  });

  it('does not constrain global or free-text searches by media category', async () => {
    ProviderManager.addProvider({
      apiKey: 'jkey', id: 'j1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    const urls: URL[] = [];
    globalThis.fetch = async input => {
      urls.push(new URL(String(input)));
      return new Response(JSON.stringify({ Results: [] }), { status: 200 });
    };

    const movie = { originalTitle: 'Original', releaseDate: '2024-01-01', title: 'Localized' };
    await ProviderSearch.search({ global: true, movie, query: 'global' });
    await ProviderSearch.search({ fromSearch: true, movie, query: 'free text' });

    assert.equal(urls[0].searchParams.has('Category[]'), false);
    assert.equal(urls[0].searchParams.get('title'), 'Localized');
    assert.equal(urls[1].searchParams.has('Category[]'), false);
    assert.equal(urls[1].searchParams.has('title'), false);
    assert.equal(urls[1].searchParams.has('year'), false);
  });

  it('deduplicates identical results across providers, keeping the higher seed count', async () => {
    ProviderManager.addProvider({
      apiKey: 'k1', id: 'j1', isEnabled: true, name: 'Jackett A', type: 'jackett', url: 'http://a.example.com',
    });
    ProviderManager.addProvider({
      apiKey: 'k2', id: 'j2', isEnabled: true, name: 'Jackett B', type: 'jackett', url: 'http://b.example.com',
    });

    const magnet = 'magnet:?xt=urn:btih:' + 'c'.repeat(40);

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      const seeders = url.includes('a.example.com') ? 10 : 50;
      return new Response(JSON.stringify({
        Results: [{ MagnetUri: magnet, Seeders: seeders, Title: 'Duplicate Title' }],
      }), { status: 200 });
    };

    const results = await ProviderSearch.search({ query: 'duplicate' });
    assert.equal(results.length, 1);
    assert.equal(results[0].seeders, 50);
  });

  it('sorts merged results by seed count descending', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'j1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://only.example.com',
    });

    globalThis.fetch = async () => new Response(JSON.stringify({
      Results: [
        { MagnetUri: 'magnet:?xt=urn:btih:' + '1'.repeat(40), Seeders: 5, Title: 'Low Seeds' },
        { MagnetUri: 'magnet:?xt=urn:btih:' + '2'.repeat(40), Seeders: 200, Title: 'High Seeds' },
      ],
    }), { status: 200 });

    const results = await ProviderSearch.search({ query: 'anything' });
    assert.equal(results[0].title, 'High Seeds');
    assert.equal(results[1].title, 'Low Seeds');
  });

  it('isolates a failing/timing-out provider without aborting the aggregated search', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'broken', isEnabled: true, name: 'Broken', type: 'jackett', url: 'http://broken.example.com',
    });
    ProviderManager.addProvider({
      apiKey: 'k', id: 'healthy', isEnabled: true, name: 'Healthy', type: 'jackett', url: 'http://healthy.example.com',
    });

    globalThis.fetch = async (input: RequestInfo | URL) => {
      if (String(input).includes('broken.example.com')) {
        throw new Error('Connection refused');
      }
      return new Response(JSON.stringify({
        Results: [{ MagnetUri: 'magnet:?xt=urn:btih:' + '3'.repeat(40), Seeders: 7, Title: 'From Healthy Provider' }],
      }), { status: 200 });
    };

    const results = await ProviderSearch.search({ query: 'anything' });
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'From Healthy Provider');
  });

  it('treats a non-ok HTTP response as an empty result set for that provider', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'unauthorized', isEnabled: true, name: 'Unauthorized', type: 'jackett', url: 'http://unauth.example.com',
    });

    globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });

    const results = await ProviderSearch.search({ query: 'anything' });
    assert.deepEqual(results, []);
  });
});
