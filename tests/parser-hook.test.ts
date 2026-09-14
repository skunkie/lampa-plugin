// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ParserHook } from '../src/providers/parser-hook';
import { ProviderManager } from '../src/providers/provider-manager';

describe('ParserHook', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();
  let originalParserGet: any;

  beforeEach(() => {
    storageMap.clear();
    originalParserGet = (_params: any, onComplete: any) => onComplete({ Results: [{ Title: 'Native Result' }] });

    (globalThis as any).Lampa = {
      Parser: {
        get: originalParserGet,
      },
      Storage: {
        get: (key: string, defaultValue: any) => (storageMap.has(key) ? storageMap.get(key) : defaultValue),
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
    storageMap.set('torrplay_enabled', false);
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ParserHook.init();

    let received: any = null;
    Lampa.Parser!.get({ search: 'ubuntu' }, data => { received = data; });

    assert.equal(received.Results[0].Title, 'Native Result');
  });
});
