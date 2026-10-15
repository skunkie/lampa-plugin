// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { NetworkError } from '../src/api/http-client';
import { TorrPlayApi, TorrPlayApiError } from '../src/api/torrplay';
import { DATABASE_SEARCH_ENABLED_STORAGE_KEY } from '../src/engine/database-search';
import { TorrPlayEngine } from '../src/engine/torrplay-engine';
import { InstanceManager } from '../src/instances/instance-manager';
import { Torrent, TorrPlayInstance } from '../src/types/torrplay';
import { DatabaseSearch } from '../src/ui/database-search';
import { TORRPLAY_STORAGE_BADGE } from '../src/ui/saved-torrent-card';
import { installFakeJquery } from './support/fake-card-element';
import { createTestLanguage, getTestTranslation } from './support/translations';

const instance: TorrPlayInstance = { authType: 'none', id: 'first', name: 'First', url: 'http://first.local' };
const saved: Torrent = {
  created_at: '2026-10-11T00:00:00Z',
  files: [{ length: 100, name: 'episode.mkv', path: 'episode.mkv' }],
  hash: 'a'.repeat(40),
  name: 'Test.Show.1080p',
  poster: 'https://images.local/poster.jpg',
  storage: 'file',
  title: 'Test Show',
  total_size: 100,
};

function storageRead(values: Map<string, unknown>, key: string, fallback: unknown): unknown {
  const value = values.get(key) || fallback || '';
  return value === 'true' || value === 'false' ? value === 'true' : value;
}

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('DatabaseSearch', () => {
  const storage = new Map<string, unknown>();
  const added: any[] = [];
  const removed: unknown[] = [];
  const activities: any[] = [];
  const storageListeners: Array<(event: { name: string }) => void> = [];
  const selectionListeners: Array<() => void> = [];
  let source: any;
  const searchListeners: Array<{ callback: (event: any) => void, name: string }> = [];

  beforeEach(() => {
    storage.clear();
    added.length = 0;
    removed.length = 0;
    activities.length = 0;
    storageListeners.length = 0;
    selectionListeners.length = 0;
    searchListeners.length = 0;
    for (const key of ['isRegistered', 'isSourceActive']) (DatabaseSearch as any)[key] = false;
    (DatabaseSearch as any).source = null;
    (DatabaseSearch as any).cancelSearch = null;
    (globalThis as any).Lampa = {
      Activity: { push: (params: unknown) => activities.push(params) },
      Controller: { enabled: () => ({ name: 'search' }), toggle: () => {} },
      Lang: createTestLanguage(),
      Noty: { show: () => {} },
      Player: { callback: () => {} },
      Search: {
        addSource: (candidate: unknown) => added.push(candidate),
        listener: { follow: (name: string, callback: (event: any) => void) => searchListeners.push({ callback, name }) },
        removeSource: (candidate: unknown) => removed.push(candidate),
      },
      Select: { show: () => {} },
      Storage: {
        get: (key: string, fallback: unknown) => storageRead(storage, key, fallback),
        listener: { follow: (_event: string, callback: (event: { name: string }) => void) => storageListeners.push(callback) },
        set: (name: string, value: unknown) => {
          storage.set(name, value);
          storageListeners.forEach(callback => callback({ name }));
        },
      },
      Torrent: { back: () => {} },
      Utils: { clearHtmlTags: (text: string) => text.replace(/<[^>]*>/g, '') },
    };
    mock.method(InstanceManager, 'getBestInstance', async () => instance);
    mock.method(InstanceManager, 'getBestKnownInstance', async () => instance);
    mock.method(InstanceManager, 'failover', async () => null);
    mock.method(InstanceManager, 'getInstances', () => [instance]);
    mock.method(InstanceManager, 'onSelectionChanged', (listener: () => void) => selectionListeners.push(listener));
    mock.method(TorrPlayApi, 'getTorrents', async () => ({ torrents: [saved] }));
    mock.method(TorrPlayApi, 'getTorrent', async () => saved);
    mock.method(TorrPlayEngine, 'startTorrentPlayback', async () => true);
  });

  afterEach(() => mock.restoreAll());

  function enable(): void {
    Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'true');
    DatabaseSearch.init();
    source = added[0];
  }

  function search(query: string): Promise<any[]> {
    return new Promise(resolve => source.search({ query }, resolve));
  }

  interface OpenedSearch {
    enabledResults: unknown[],
    focusedTabs: number[]
  }

  // Plays Lampa's global search opening: the `sources` event, a `create` event per tab in tab
  // order, then `open`, recording which tab gets selected and which tab element gets focus.
  function openGlobalSearch(tabSources: unknown[]): OpenedSearch {
    const opened: OpenedSearch = { enabledResults: [], focusedTabs: [] };
    const createListeners: Array<(created: unknown) => void> = [];
    const tabElements = tabSources.map((_tabSource, index) => ({
      dispatchEvent: (event: Event) => {
        if (event.type === 'hover:focus') opened.focusedTabs.push(index);
      },
    }));
    const tabs = {
      enable: (result: unknown) => opened.enabledResults.push(result),
      listener: { follow: (_name: string, callback: (created: unknown) => void) => createListeners.push(callback) },
      tabs: () => ({ querySelectorAll: () => tabElements }),
    };
    const send = (name: string, event: unknown) => searchListeners
      .filter(listener => listener.name === name)
      .forEach(listener => listener.callback(event));
    send('sources', { sources: tabs });
    tabSources.forEach((tabSource, index) => {
      createListeners.forEach(callback => callback({ result: `result-${index}`, source: tabSource }));
    });
    send('open', undefined);
    return opened;
  }

  it('opens global search on its own tab when opened from the TorrPlay library', () => {
    enable();
    (globalThis as any).Lampa.Activity.active = () => ({ component: 'torrplay_torrents' });

    const opened = openGlobalSearch([{ title: 'TMDB' }, source]);

    assert.deepEqual(opened.enabledResults, ['result-1']);
    assert.deepEqual(opened.focusedTabs, [1]);
  });

  it('leaves global search on its first tab when opened anywhere else', () => {
    enable();
    (globalThis as any).Lampa.Activity.active = () => ({ component: 'main' });

    const opened = openGlobalSearch([{ title: 'TMDB' }, source]);

    assert.deepEqual(opened, { enabledResults: [], focusedTabs: [] });
  });

  it('leaves global search alone when its source is switched off', () => {
    enable();
    Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'false');
    (globalThis as any).Lampa.Activity.active = () => ({ component: 'torrplay_torrents' });

    const opened = openGlobalSearch([{ title: 'TMDB' }, source]);

    assert.deepEqual(opened, { enabledResults: [], focusedTabs: [] });
  });

  it('defaults off and adds/removes one source when toggled independently of providers', () => {
    DatabaseSearch.init();
    assert.equal(added.length, 0);
    Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'true');
    DatabaseSearch.init();
    assert.equal(added.length, 1);
    Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'false');
    assert.deepEqual(removed, [added[0]]);
    Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'true');
    Lampa.Storage.set('torrplay_enabled', 'false');
    assert.equal(added.length, 2);
    assert.equal(removed.length, 2);
  });

  it('lists the saved torrents the instance matches to the decoded query', async () => {
    enable();
    const listing = mock.method(TorrPlayApi, 'getTorrents', async (_instance: TorrPlayInstance, options?: { search?: string }) => ({
      torrents: options?.search === 'missing' ? [] : [saved],
    }));
    const rows = await search(encodeURIComponent('SHOW 1080P'));
    assert.deepEqual(listing.mock.calls[0].arguments[1], { fuzzy: true, saved: true, search: 'SHOW 1080P' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].total, 1);
    assert.equal(rows[0].results[0].torrent.title, saved.title);
    assert.equal(rows[0].results[0].torrent.poster, saved.poster);
    assert.equal(rows[0].results[0].instanceId, instance.id);
    assert.equal(rows[0].results[0].torrentHash, saved.hash);
    assert.deepEqual(await search('missing'), []);

    await search(encodeURIComponent('Стальные слёзы'));
    assert.equal((listing.mock.calls[2].arguments[1] as { search?: string }).search, 'Стальные слёзы');
  });

  it('keeps the instance ranking', async () => {
    enable();
    const fuzzyMatch = { ...saved, hash: 'b'.repeat(40), name: 'Sintl', title: 'Sintl' };
    const exactMatch = { ...saved, hash: 'c'.repeat(40), name: 'Sintel', title: 'Sintel' };
    mock.method(TorrPlayApi, 'getTorrents', async () => ({ torrents: [exactMatch, fuzzyMatch] }));
    const rows = await search('sintel');
    assert.deepEqual(rows[0].results.map((item: { torrentHash: string }) => item.torrentHash), [exactMatch.hash, fuzzyMatch.hash]);
  });

  it('searches with every query so the tab can show a result count', () => {
    assert.equal(source.params.lazy, false);
  });

  it('hands every match to the row so the tab counts them all, and offers More past one page', async () => {
    enable();
    mock.method(TorrPlayApi, 'getTorrents', async () => ({ torrents: Array.from({ length: 25 }, (_value, index) => ({ ...saved, hash: String(index) })) }));
    const rows = await search('test');
    assert.equal(rows[0].results.length, 25);
    assert.equal(rows[0].total, 25);
    assert.equal(rows[0].total_pages, 2);
    let isClosed = false;
    source.onMore({ data: rows[0], query: 'test' }, () => { isClosed = true; });
    assert.equal(isClosed, true);
    assert.equal(activities[0].component, 'torrplay_torrents');
    assert.equal(activities[0].search, 'test');
  });

  it('preserves the decoded row query when More opens recalled results', async () => {
    enable();
    const query = 'Фильм 100%20';
    const listing = mock.method(TorrPlayApi, 'getTorrents', async (_instance: TorrPlayInstance, _options?: object) => ({
      torrents: [{ ...saved, title: query }],
    }));
    const rows = JSON.parse(JSON.stringify(await search(encodeURIComponent(query))));
    source.onRecall(rows);
    assert.deepEqual(listing.mock.calls[0].arguments[1], { fuzzy: true, saved: true, search: query });
    assert.equal(rows[0].results.length, 1);
    for (const nativeQuery of [undefined, '', 'other']) {
      source.onMore({ data: rows[0], query: nativeQuery }, () => {});
      const activity = activities[activities.length - 1];
      assert.equal(activity.search, query);
    }
  });

  it('settles failures and requests made through a source retained after disabling', async () => {
    enable();
    mock.method(TorrPlayApi, 'getTorrents', async () => { throw new Error('offline'); });
    assert.deepEqual(await search('test'), []);
    Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'false');
    assert.deepEqual(await search('test'), []);
  });

  for (const error of [
    new NetworkError('Failed to fetch'),
    new NetworkError('Network error (http://first.local): request timed out'),
    Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    new TorrPlayApiError('Unavailable', 503),
  ]) {
    it(`retries database listing on a fallback instance after ${error.name}: ${error.message}`, async () => {
      enable();
      const fallback = { ...instance, id: 'fallback', name: 'Backup', url: 'http://backup.local' };
      const requestedInstances: string[] = [];
      mock.method(InstanceManager, 'failover', async (failed: TorrPlayInstance) => {
        assert.equal(failed, instance);
        return fallback;
      });
      const listing = mock.method(TorrPlayApi, 'getTorrents', async (selected: TorrPlayInstance, _options?: object) => {
        requestedInstances.push(selected.id);
        if (selected === instance) throw error;
        return { torrents: [saved] };
      });
      const rows = await search('test');
      assert.deepEqual(requestedInstances, [instance.id, fallback.id]);
      assert.deepEqual(listing.mock.calls[1].arguments[1], { fuzzy: true, saved: true, search: 'test' });
      assert.equal(rows[0].results[0].instanceId, fallback.id);
    });
  }

  it('does not reroute authentication or other client errors', async () => {
    enable();
    for (const status of [400, 401, 403, 404]) {
      mock.method(TorrPlayApi, 'getTorrents', async () => { throw new TorrPlayApiError('Client error', status); });
      assert.deepEqual(await search('test'), []);
    }
    assert.equal((InstanceManager.failover as any).mock.callCount(), 0);
  });

  it('leaves the selected instance intact on Bearer credential and response parsing errors', async () => {
    enable();
    for (const error of [
      new Error('Username and password required for Bearer authentication'),
      new Error('Bearer auth failed (401): Unauthorized'),
      new SyntaxError('Unexpected token in JSON'),
      new TypeError("Cannot read properties of undefined (reading 'torrents')"),
    ]) {
      mock.method(TorrPlayApi, 'getTorrents', async () => { throw error; });
      assert.deepEqual(await search('test'), []);
    }
    assert.equal((InstanceManager.failover as any).mock.callCount(), 0);
  });

  it('limits failed database listing attempts to the primary and one fallback', async () => {
    enable();
    const fallback = { ...instance, id: 'fallback' };
    mock.method(InstanceManager, 'failover', async () => fallback);
    mock.method(TorrPlayApi, 'getTorrents', async () => { throw new NetworkError('Network error (http://first.local)'); });
    assert.deepEqual(await search('test'), []);
    assert.equal((TorrPlayApi.getTorrents as any).mock.callCount(), 2);
    assert.equal((InstanceManager.failover as any).mock.callCount(), 1);
  });

  it('does not start failover when the failing request has been canceled', async () => {
    enable();
    let fail: () => void = () => {};
    mock.method(TorrPlayApi, 'getTorrents', () => new Promise((_resolve, reject) => {
      fail = () => reject(new NetworkError('Network error (http://first.local)'));
    }));
    const pending = search('test');
    await flush();
    source.onCancel();
    fail();
    assert.deepEqual(await pending, []);
    await flush();
    assert.equal((InstanceManager.failover as any).mock.callCount(), 0);
  });

  it('does not request fallback results after cancellation during failover discovery', async () => {
    enable();
    let finish: (value: TorrPlayInstance) => void = () => {};
    let isAborted: (() => boolean) | undefined;
    mock.method(InstanceManager, 'failover', (_failed: TorrPlayInstance, cancellation?: () => boolean) => {
      isAborted = cancellation;
      return new Promise<TorrPlayInstance>(resolve => { finish = resolve; });
    });
    mock.method(TorrPlayApi, 'getTorrents', async () => { throw new NetworkError('Network error (http://first.local)'); });
    const pending = search('test');
    await flush();
    source.onCancel();
    assert.equal(isAborted?.(), true);
    finish({ ...instance, id: 'fallback' });
    assert.deepEqual(await pending, []);
    await flush();
    assert.equal((TorrPlayApi.getTorrents as any).mock.callCount(), 1);
  });

  it('discards fallback results that arrive after the search is canceled', async () => {
    enable();
    const fallback = { ...instance, id: 'fallback' };
    let finish: (value: { torrents: Torrent[] }) => void = () => {};
    mock.method(InstanceManager, 'failover', async () => fallback);
    mock.method(TorrPlayApi, 'getTorrents', (selected: TorrPlayInstance) => {
      if (selected === instance) return Promise.reject(new NetworkError('Network error (http://first.local)'));
      return new Promise<{ torrents: Torrent[] }>(resolve => { finish = resolve; });
    });
    let completions = 0;
    const pending = new Promise(resolve => source.search({ query: 'test' }, (rows: unknown) => { completions++; resolve(rows); }));
    await flush();
    source.onCancel();
    assert.deepEqual(await pending, []);
    finish({ torrents: [saved] });
    await flush();
    assert.equal(completions, 1);
  });

  for (const action of ['cancel', 'disable', 'reroute', 'replace']) {
    it(`discards late database responses after ${action}`, async () => {
      enable();
      let release: (value: { torrents: Torrent[] }) => void = () => {};
      mock.method(TorrPlayApi, 'getTorrents', () => new Promise<{ torrents: Torrent[] }>(resolve => { release = resolve; }));
      let completions = 0;
      const pending = new Promise(resolve => source.search({ query: 'test' }, (rows: unknown) => { completions++; resolve(rows); }));
      await flush();
      if (action === 'cancel') source.onCancel();
      if (action === 'disable') Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'false');
      if (action === 'reroute') selectionListeners[0]();
      if (action === 'replace') {
        void search('other');
        source.onCancel();
      }
      assert.deepEqual(await pending, []);
      release({ torrents: [saved] });
      await flush();
      assert.equal(completions, 1);
    });
  }

  it('plays a selected saved torrent on its original instance and restores its search row on return', async () => {
    enable();
    let restoreLine: () => void = () => {};
    let wasRestored = false;
    mock.method(Lampa.Player, 'callback', (callback: () => void) => { restoreLine = callback; });
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => { wasRestored = true; } } });
    await flush();
    const playback = (TorrPlayEngine.startTorrentPlayback as any).mock.calls[0];
    assert.equal(playback.arguments[0], saved);
    assert.equal(playback.arguments[1], 0);
    assert.equal(playback.arguments[3], instance);
    assert.equal(playback.arguments[4], 'search');
    restoreLine();
    assert.equal(wasRestored, true);
  });

  interface FileListModal {
    files: Array<{ data: Record<string, unknown>, enter: () => void }>,
    options: any
  }

  // Stands in for Lampa's modal, jQuery and file row template, so tests can read the styled
  // file list the way a viewer sees it and press its rows.
  function installFileList(): FileListModal {
    const modal: FileListModal = { files: [], options: null };
    (globalThis as any).$ = () => ({ append: () => {} });
    (globalThis as any).Lampa.Template = {
      get: (_name: string, data: Record<string, unknown>) => {
        const file = { data, enter: () => {} };
        modal.files.push(file);
        return {
          0: {},
          append: () => {},
          find: () => ({ 0: {}, addClass: () => {}, attr: () => '' }),
          on: (event: string, callback: () => void) => { if (event === 'hover:enter') file.enter = callback; },
        };
      },
    };
    (globalThis as any).Lampa.Modal = { close: () => {}, open: (options: unknown) => { modal.options = options; } };
    (globalThis as any).Lampa.Utils.bytesToSize = (bytes: number) => `${bytes} B`;
    (globalThis as any).Lampa.Controller.collectionFocus = () => {};
    mock.method(TorrPlayEngine, 'fetchSeasonEpisodes', async () => ({}));
    return modal;
  }

  it('offers video files in sorted order and preserves the original file index', async () => {
    enable();
    const multi = { ...saved, files: [
      { length: 1, name: 'readme.txt', path: 'readme.txt' },
      { length: 10, name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
      { length: 10, name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
    ] };
    mock.method(TorrPlayApi, 'getTorrent', async () => multi);
    const modal = installFileList();
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => {} } });
    await flush();
    await flush();
    // Episode files get the episode row, which names the file in `fname`.
    assert.deepEqual(modal.files.map(file => file.data.fname), ['Show.S01E01', 'Show.S01E02']);
    modal.files[0].enter();
    await flush();
    const playback = (TorrPlayEngine.startTorrentPlayback as any).mock.calls[0];
    assert.equal(playback.arguments[1], 2);
    // The list stays open under the player, which hands focus back to it.
    assert.equal(playback.arguments[4], 'modal');
  });

  it('lists a multi-file torrent in the same styled file list as the TorrPlay library', async () => {
    enable();
    const multi = { ...saved, files: [
      { length: 2048, name: 'one.mkv', path: 'one.mkv' },
      { length: 10, name: 'two.avi', path: 'two.avi' },
    ] };
    mock.method(TorrPlayApi, 'getTorrent', async () => multi);
    let selectCount = 0;
    mock.method(Lampa.Select, 'show', () => { selectCount++; });
    const modal = installFileList();
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => {} } });
    await flush();
    await flush();
    assert.equal(selectCount, 0);
    assert.equal(modal.options.size, 'large');
    assert.equal(modal.options.title, 'title_files');
    assert.deepEqual(modal.files.map(file => file.data), [
      { exe: 'mkv', size: '2048 B', title: 'one' },
      { exe: 'avi', size: '10 B', title: 'two' },
    ]);
  });

  it('does not play a cached result on a different instance when its original one was removed', async () => {
    enable();
    const rows = await search('test');
    mock.method(InstanceManager, 'getInstances', () => []);
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => {} } });
    await flush();
    assert.equal((TorrPlayEngine.startTorrentPlayback as any).mock.callCount(), 0);
  });

  it('starts playback without borrowing a movie from an unrelated activity', async () => {
    enable();
    (globalThis as any).Lampa.Activity.active = () => ({ movie: { id: 123, title: 'Unrelated Movie' } });
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => {} } });
    await flush();
    assert.equal((TorrPlayEngine.startTorrentPlayback as any).mock.calls[0].arguments[2], undefined);
  });

  it('resolves the listing instance from benchmarks already gathered', async () => {
    enable();
    const rows = await search('test');
    assert.equal(rows[0].results[0].instanceId, instance.id);
    assert.equal((InstanceManager.getBestKnownInstance as any).mock.callCount(), 1);
    assert.equal((TorrPlayApi.getTorrents as any).mock.calls[0].arguments[0], instance);
  });

  it('settles with no rows when no instance is configured', async () => {
    enable();
    mock.method(InstanceManager, 'getBestKnownInstance', async () => { throw new Error('No TorrPlay instances configured'); });
    assert.deepEqual(await search('test'), []);
    assert.equal((TorrPlayApi.getTorrents as any).mock.callCount(), 0);
  });

  it('opens More on the instance that produced the row', async () => {
    enable();
    const fallback = { ...instance, id: 'fallback', name: 'Backup', url: 'http://backup.local' };
    mock.method(InstanceManager, 'failover', async () => fallback);
    mock.method(TorrPlayApi, 'getTorrents', async (selected: TorrPlayInstance) => {
      if (selected === instance) throw new NetworkError('Failed to fetch');
      return { torrents: [saved] };
    });
    const rows = await search('test');
    source.onMore({ data: rows[0] }, () => {});
    assert.equal(activities[activities.length - 1].instanceId, fallback.id);
  });

  it('keeps recalled rows served by a failover instance that is still in the pool', async () => {
    enable();
    const fallback = { ...instance, id: 'fallback', name: 'Backup', url: 'http://backup.local' };
    mock.method(InstanceManager, 'getInstances', () => [instance, fallback]);
    mock.method(InstanceManager, 'failover', async () => fallback);
    mock.method(TorrPlayApi, 'getTorrents', async (selected: TorrPlayInstance) => {
      if (selected === instance) throw new NetworkError('Failed to fetch');
      return { torrents: [saved] };
    });
    const rows = JSON.parse(JSON.stringify(await search('test')));
    source.onRecall(rows);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].results[0].instanceId, fallback.id);
    mock.method(InstanceManager, 'getInstances', () => [instance]);
    source.onRecall(rows);
    assert.deepEqual(rows, []);
  });

  it('strips markup from torrent and file names before Lampa renders them', async () => {
    enable();
    const hostile = { ...saved, files: [
      { length: 10, name: '<img src=x onerror=alert(1)>one.mkv', path: 'one.mkv' },
      { length: 10, name: 'two.mkv', path: 'two.mkv' },
    ], title: '<b>Test</b> Show' };
    mock.method(TorrPlayApi, 'getTorrents', async () => ({ torrents: [hostile] }));
    mock.method(TorrPlayApi, 'getTorrent', async () => hostile);
    const modal = installFileList();
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => {} } });
    await flush();
    await flush();
    assert.deepEqual(modal.files.map(file => file.data.title), ['one', 'two']);
  });

  it('hands a saved torrent without loaded file metadata to playback instead of throwing', async () => {
    enable();
    const notices: string[] = [];
    mock.method(Lampa.Noty, 'show', (message: string) => notices.push(message));
    mock.method(TorrPlayApi, 'getTorrent', async () => ({ ...saved, files: undefined as unknown as Torrent['files'] }));
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => {} } });
    await flush();
    const playback = (TorrPlayEngine.startTorrentPlayback as any).mock.calls[0];
    assert.equal(playback.arguments[1], 0);
    assert.deepEqual(notices, []);
  });

  it('shows only the error message when playback fails', async () => {
    enable();
    const notices: string[] = [];
    mock.method(Lampa.Noty, 'show', (message: string) => notices.push(message));
    mock.method(TorrPlayEngine, 'startTorrentPlayback', async () => { throw new Error('Instance offline'); });
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => {} } });
    await flush();
    assert.equal(notices.length, 1);
    assert.ok(notices[0].includes('Instance offline'));
    assert.ok(!notices[0].includes('Error:'));
  });

  it('returns to the file list after canceled multi-file playback', async () => {
    enable();
    const multi = { ...saved, files: [
      { length: 10, name: 'one.mkv', path: 'one.mkv' },
      { length: 10, name: 'two.mkv', path: 'two.mkv' },
    ] };
    mock.method(TorrPlayApi, 'getTorrent', async () => multi);
    const modal = installFileList();
    let controller = 'items_line';
    let restorations = 0;
    mock.method(Lampa.Controller, 'enabled', () => ({ name: controller }));
    mock.method(Lampa.Controller, 'toggle', (name: string) => { controller = name; });
    mock.method(TorrPlayEngine, 'startTorrentPlayback', async () => {
      controller = 'loading';
      return false;
    });
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => { restorations++; controller = 'items_line'; } } });
    await flush();
    await flush();
    controller = 'modal';
    modal.files[0].enter();
    await flush();
    assert.equal(controller, 'modal');
    assert.equal(restorations, 0);
  });

  it('restores the search row on file list Back, and the file list on playback errors', async () => {
    enable();
    const multi = { ...saved, files: [
      { length: 10, name: 'one.mkv', path: 'one.mkv' },
      { length: 10, name: 'two.mkv', path: 'two.mkv' },
    ] };
    mock.method(TorrPlayApi, 'getTorrent', async () => multi);
    const modal = installFileList();
    let closeCount = 0;
    (globalThis as any).Lampa.Modal.close = () => { closeCount++; };
    const toggled: string[] = [];
    mock.method(Lampa.Controller, 'toggle', (name: string) => { toggled.push(name); });
    let restorations = 0;
    mock.method(TorrPlayEngine, 'startTorrentPlayback', async () => { throw new Error('offline'); });
    const rows = await search('test');
    source.onSelect({ element: rows[0].results[0], line: { toggle: () => { restorations++; } } });
    await flush();
    await flush();
    modal.files[0].enter();
    await flush();
    assert.deepEqual(toggled, ['modal']);
    assert.equal(restorations, 0);
    modal.options.onBack();
    assert.equal(closeCount, 1);
    assert.equal(restorations, 1);
    assert.deepEqual(toggled, ['modal', 'search']);
  });

  it('restores the card factory on same-session cached rows', async () => {
    enable();
    const cards = installFakeJquery();
    (globalThis as any).Lampa.Utils.bytesToSize = (bytes: number) => `${bytes} B`;
    const rows = JSON.parse(JSON.stringify(await search('test')));
    source.onRecall(rows);
    assert.equal(rows[0].results.length, 1);
    const item = rows[0].results[0];
    item.params.createInstance(item).create();
    assert.ok(cards[0].markup.includes('<div class="card__title">Test Show</div>'));
  });

  it('draws a match with the same card as the TorrPlay library', async () => {
    enable();
    const cards = installFakeJquery();
    (globalThis as any).Lampa.Utils.bytesToSize = (bytes: number) => `${bytes} B`;
    const rows = await search('test');
    const item = rows[0].results[0];
    const card = item.params.createInstance(item);
    card.create();
    assert.equal(card.render(), cards[0]);
    assert.equal(card.render(true), cards[0][0]);
    assert.ok(cards[0].markup.includes(`<div class="card__age">100 B · ${getTestTranslation('torrplay_card_file_count', { count: 1 })}</div>`));
    assert.ok(cards[0].markup.includes(TORRPLAY_STORAGE_BADGE));
  });

  it('plays a card through the row\'s own selection', async () => {
    enable();
    const cards = installFakeJquery();
    (globalThis as any).Lampa.Utils.bytesToSize = (bytes: number) => `${bytes} B`;
    const rows = await search('test');
    const item = rows[0].results[0];
    const card = item.params.createInstance(item);
    let enterCount = 0;
    card.use({ onEnter: () => { enterCount++; } });
    card.create();
    cards[0].listeners.get('hover:enter')!();
    assert.equal(enterCount, 1);
  });

  it('offers only the viewed mark on long press and applies it to the card', async () => {
    enable();
    const cards = installFakeJquery();
    (globalThis as any).Lampa.Utils.bytesToSize = (bytes: number) => `${bytes} B`;
    let options: any;
    mock.method(Lampa.Select, 'show', (value: any) => { options = value; });
    const toggled: string[] = [];
    mock.method(Lampa.Controller, 'enabled', () => ({ name: 'items_line' }));
    mock.method(Lampa.Controller, 'toggle', (name: string) => { toggled.push(name); });
    const rows = await search('test');
    const item = rows[0].results[0];
    const card = item.params.createInstance(item);
    card.create();

    cards[0].listeners.get('hover:long')!();
    assert.deepEqual(options.items.map((menuItem: any) => menuItem.action), ['mark']);
    options.onSelect(options.items[0]);
    assert.deepEqual(storage.get('torrents_view'), [saved.hash]);
    assert.equal(cards[0].isViewed, true);
    assert.deepEqual(toggled, ['items_line']);

    cards[0].listeners.get('hover:long')!();
    assert.deepEqual(options.items.map((menuItem: any) => menuItem.action), ['unmark']);
    options.onSelect(options.items[0]);
    assert.deepEqual(storage.get('torrents_view'), []);
    assert.equal(cards[0].isViewed, false);

    cards[0].listeners.get('hover:long')!();
    options.onBack();
    assert.deepEqual(toggled, ['items_line', 'items_line', 'items_line']);
  });

  it('removes its card and drops a pending watched overlay when destroyed', async () => {
    enable();
    const cards = installFakeJquery();
    (globalThis as any).Lampa.Utils.bytesToSize = (bytes: number) => `${bytes} B`;
    const rows = await search('test');
    const item = rows[0].results[0];
    const card = item.params.createInstance(item);
    card.create();
    card.destroy();
    assert.equal(cards[0].isRemoved, true);
    assert.equal(card.render(true), undefined);
  });

  it('removes empty recalled rows in place and preserves populated rows', async () => {
    enable();
    const [validRow] = JSON.parse(JSON.stringify(await search('test')));
    const staleRow = {
      ...validRow,
      results: [{ ...validRow.results[0], databaseScopeId: 'old-session' }],
    };
    const emptyRow = { ...validRow, results: [] };
    const rows = [staleRow, validRow, emptyRow];
    const originalRows = rows;
    source.onRecall(rows);
    assert.equal(rows, originalRows);
    assert.deepEqual(rows, [validRow]);
    assert.equal(typeof validRow.results[0].params.createInstance, 'function');
  });

  it('leaves no empty line for Lampa to focus after recalling invalidated results', async () => {
    enable();
    const cachedRows = JSON.parse(JSON.stringify(await search('test')));
    selectionListeners[0]();
    source.onRecall(cachedRows);
    // Lampa builds one line per returned row and treats any line as navigable results.
    const builtLines: any[] = [];
    cachedRows.forEach((row: any) => builtLines.push(row));
    assert.equal(builtLines.length, 0);
  });

  for (const action of ['reroute', 'reload', 'disable']) {
    it(`rejects cached database rows and selections after ${action}`, async () => {
      enable();
      const rows = JSON.parse(JSON.stringify(await search('test')));
      const staleItem = rows[0].results[0];
      if (action === 'reroute') selectionListeners[0]();
      if (action === 'reload') {
        (DatabaseSearch as any).isRegistered = false;
        DatabaseSearch.init();
      }
      if (action === 'disable') Lampa.Storage.set(DATABASE_SEARCH_ENABLED_STORAGE_KEY, 'false');
      source.onRecall(rows);
      assert.deepEqual(rows, []);
      source.onSelect({ element: staleItem, line: { toggle: () => {} } });
      await flush();
      assert.equal((TorrPlayEngine.startTorrentPlayback as any).mock.callCount(), 0);
    });
  }

  for (const shouldFail of [false, true]) {
    it(`ignores ${shouldFail ? 'failed' : 'successful'} metadata arriving after search closes`, async () => {
      enable();
      let complete: () => void = () => {};
      mock.method(TorrPlayApi, 'getTorrent', () => new Promise<Torrent>((resolve, reject) => {
        complete = () => shouldFail ? reject(new Error('offline')) : resolve(saved);
      }));
      let restorations = 0;
      const rows = await search('test');
      source.onSelect({ element: rows[0].results[0], line: { toggle: () => { restorations++; } } });
      source.onCancel();
      complete();
      await flush();
      assert.equal((TorrPlayEngine.startTorrentPlayback as any).mock.callCount(), 0);
      assert.equal(restorations, 0);
    });
  }

});
