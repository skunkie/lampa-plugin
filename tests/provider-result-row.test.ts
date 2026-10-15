// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ProviderSearchResult } from '../src/types/provider';
import { attachRowFactory, buildMediaTags, ProviderResultRow, ProviderResultRowData } from '../src/ui/provider-result-row';

class FakeElement {
  public children: FakeElement[] = [];
  public className = '';
  public isRemoved = false;
  public style: Record<string, string> = {};
  public textContent = '';

  public append(child: FakeElement): void {
    this.children.push(child);
  }

  public remove(): void {
    this.isRemoved = true;
  }
}

/**
 * Stands in for the jQuery-wrapped `torrent` template: each named part of the row can be
 * found, removed, shown or appended to, and the row records the listeners and markup added.
 */
class FakeTorrentRow {
  public readonly 0 = new FakeElement();
  public readonly appendedMarkup: string[] = [];
  public readonly listeners = new Map<string, () => void>();
  public readonly parts = new Map<string, { appended: FakeElement[], classes: Set<string>, isRemoved: boolean }>();

  public constructor(public readonly templateData: Record<string, unknown>) {
    ['.bitrate', '.torrent-item__date', '.torrent-item__ffprobe', '.torrent-item__size'].forEach(selector => {
      this.parts.set(selector, { appended: [], classes: new Set(selector === '.torrent-item__ffprobe' ? ['hide'] : []), isRemoved: false });
    });
  }

  public append(markup: string): void {
    this.appendedMarkup.push(markup);
  }

  public find(selector: string): any {
    if (selector === '.torrent-item__viewed') {
      const markers = this.appendedMarkup.filter(markup => markup.includes('torrent-item__viewed'));
      return {
        length: markers.length,
        remove: () => {
          this.appendedMarkup.splice(0, this.appendedMarkup.length, ...this.appendedMarkup.filter(markup => !markup.includes('torrent-item__viewed')));
        },
      };
    }
    const part = this.parts.get(selector)!;
    return {
      append: (element: FakeElement) => part.appended.push(element),
      length: 1,
      remove: () => { part.isRemoved = true; },
      removeClass: (className: string) => part.classes.delete(className),
    };
  }

  public on(eventName: string, callback: () => void): void {
    this.listeners.set(eventName, callback);
  }
}

function createResult(overrides: Partial<ProviderSearchResult> = {}): ProviderSearchResult {
  return {
    leechers: 4,
    publishedAt: '2026-10-01T12:00:00',
    seeders: 12,
    sizeBytes: 2048,
    title: 'Movie <b>2026</b> 1080p',
    tracker: 'Tracker <i>One</i>',
    ...overrides,
  };
}

function createRowData(result = createResult()): ProviderResultRowData {
  return {
    result,
    results: [{ hash: 'row-hash', Seeders: result.seeders, Title: result.title } as LampaParserResultItem],
  };
}

describe('Provider Result Rows', () => {
  const storageMap = new Map<string, unknown>();
  const sentEvents: any[] = [];
  const controllers = new Map<string, any>();
  const toggledControllers: string[] = [];
  const collections: any[] = [];
  let shownSelect: any = null;
  let createdRows: FakeTorrentRow[] = [];

  beforeEach(() => {
    storageMap.clear();
    sentEvents.length = 0;
    controllers.clear();
    toggledControllers.length = 0;
    collections.length = 0;
    shownSelect = null;
    createdRows = [];
    (globalThis as any).document = { createElement: () => new FakeElement() };
    (globalThis as any).Lampa = {
      Controller: {
        add: (name: string, controller: any) => controllers.set(name, controller),
        collectionFocus: (focus: unknown, container: unknown) => collections.push({ container, focus }),
        collectionSet: (container: unknown) => collections.push({ container }),
        enabled: () => ({ name: 'search_results' }),
        toggle: (name: string) => {
          toggledControllers.push(name);
          controllers.get(name)?.toggle?.();
        },
      },
      Lang: { translate: (key: string) => key },
      Listener: { send: (name: string, event: unknown) => sentEvents.push({ event, name }) },
      Select: { show: (options: unknown) => { shownSelect = options; } },
      Storage: {
        get: (key: string, fallback: unknown) => (storageMap.has(key) ? storageMap.get(key) : fallback),
        set: (key: string, value: unknown) => storageMap.set(key, value),
      },
      Template: {
        get: (name: string, data: Record<string, unknown>, asString?: boolean) => {
          if (name === 'icon_viewed') return asString ? '<svg></svg>' : null;
          const row = new FakeTorrentRow(data);
          createdRows.push(row);
          return row;
        },
      },
      Utils: {
        bytesToSize: (bytes: number) => `${bytes} B`,
        clearHtmlTags: (text: string) => text.replace(/<[^>]*>/g, ''),
        parseTime: (value: string) => ({ full: `parsed ${value}` }),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  describe('buildMediaTags', () => {
    it('describes the release quality, picture size and surround channels', () => {
      const tags = buildMediaTags(createResult({
        ffprobe: [
          { codec_type: 'video', height: 1080, width: 1920 },
          { channels: 6, codec_type: 'audio' },
          { channels: 8, codec_type: 'audio' },
        ],
        info: { quality: 2160 },
      }));

      assert.deepEqual(tags, [
        { kind: 'resolution', value: '4K' },
        { kind: 'video', value: '1920x1080' },
        { kind: 'channels', value: '7.1' },
        { kind: 'channels', value: '5.1' },
      ]);
    });

    it('derives the resolution from the video width when the indexer gives no quality', () => {
      assert.deepEqual(buildMediaTags(createResult({ ffprobe: [{ codec_type: 'video', height: 720, width: 1280 }] }))[0], {
        kind: 'resolution', value: 'HD',
      });
      assert.deepEqual(buildMediaTags(createResult({ info: { quality: 576 } })), [{ kind: 'resolution', value: '576p' }]);
    });

    it('names audio tracks by language and voice, labels dubbing and keeps leftover voices', () => {
      const tags = buildMediaTags(createResult({
        ffprobe: [
          { codec_type: 'audio', tags: { language: 'rus', title: 'Dub, Studio' } },
          { codec_type: 'audio', tags: { language: 'eng', title: 'Original' } },
          { codec_type: 'audio', tags: { language: 'ukr', title: 'lostfilm team' } },
        ],
        info: { voices: ['LostFilm', 'Kubik'] },
      }));

      assert.deepEqual(tags, [
        { kind: 'audio', value: 'RUS - Dubbing' },
        { kind: 'audio', value: 'ENG' },
        { kind: 'audio', value: 'UKR - LostFilm' },
        { kind: 'audio', value: 'Kubik' },
      ]);
    });

    it('lists distinct subtitle languages up to a limit and counts the rest', () => {
      const languages = ['rus', 'eng', 'rus', 'ukr', 'fra', 'deu', 'spa'];
      const tags = buildMediaTags(createResult({
        ffprobe: languages.map(language => ({ codec_type: 'subtitle', tags: { language } })),
      }));

      assert.deepEqual(tags.map(tag => tag.value), ['RUS', 'ENG', 'UKR', 'FRA', '+2']);
    });

    it('returns no tags for a release without media information', () => {
      assert.deepEqual(buildMediaTags(createResult()), []);
    });
  });

  describe('ProviderResultRow', () => {
    it('fills Lampa\'s torrent row with markup-free text and the release tags', () => {
      const row = new ProviderResultRow(createRowData(createResult({ ffprobe: [{ channels: 6, codec_type: 'audio' }] })));
      row.create();

      const torrentRow = createdRows[0];
      assert.deepEqual(torrentRow.templateData, {
        date: 'parsed 2026-10-01',
        grabs: 4,
        seeds: 12,
        size: '2048 B',
        title: 'Movie 2026 1080p',
        tracker: 'Tracker One',
      });
      assert.equal(torrentRow.parts.get('.bitrate')!.isRemoved, true);
      assert.equal(torrentRow.parts.get('.torrent-item__date')!.isRemoved, false);
      const tagList = torrentRow.parts.get('.torrent-item__ffprobe')!;
      assert.equal(tagList.classes.has('hide'), false);
      assert.deepEqual(tagList.appended.map(tag => [tag.className, tag.textContent]), [['m-channels', '5.1']]);
      const container = row.render(true) as unknown as FakeElement;
      assert.equal(container.className, 'torrent-list');
      assert.deepEqual(container.children, [torrentRow[0]]);
    });

    it('keeps text literal through Lampa\'s template filling', () => {
      const row = new ProviderResultRow(createRowData(createResult({
        title: 'Ca$h & {size} <b>Bold</b> 5 > 4',
        tracker: '$&',
      })));
      row.create();

      assert.equal(createdRows[0].templateData.title, 'Ca$$h &amp; &#123;size} Bold 5 &gt; 4');
      assert.equal(createdRows[0].templateData.tracker, '$$&amp;');
    });

    it('hands Lampa\'s date formatter a plain date whatever format the indexer used', () => {
      const row = new ProviderResultRow(createRowData(createResult({ publishedAt: 'Thu, 01 Oct 2026 12:00:00' })));
      row.create();

      assert.equal(createdRows[0].templateData.date, 'parsed 2026-10-01');
    });

    it('leaves out a date it cannot read', () => {
      const row = new ProviderResultRow(createRowData(createResult({ publishedAt: 'not a date' })));
      row.create();

      assert.equal(createdRows[0].templateData.date, '');
      assert.equal(createdRows[0].parts.get('.torrent-item__date')!.isRemoved, true);
    });

    it('returns focus to its own row when the focused screen cannot be read', () => {
      (globalThis as any).Lampa.Controller.enabled = () => undefined;
      const row = new ProviderResultRow(createRowData());
      row.create();
      createdRows[0].listeners.get('hover:long')!();

      shownSelect.onBack();

      assert.deepEqual(toggledControllers, ['torrplay_provider_result']);
    });

    it('leaves out the date and size it does not know', () => {
      const row = new ProviderResultRow(createRowData(createResult({ publishedAt: undefined, sizeBytes: undefined })));
      row.create();

      assert.equal(createdRows[0].parts.get('.torrent-item__date')!.isRemoved, true);
      assert.equal(createdRows[0].parts.get('.torrent-item__size')!.isRemoved, true);
      assert.equal(createdRows[0].parts.get('.torrent-item__ffprobe')!.classes.has('hide'), true);
    });

    it('announces the rendered torrent so its saved state can be looked up', () => {
      const data = createRowData();
      new ProviderResultRow(data).create();

      assert.deepEqual(sentEvents, [{ event: { element: data.results[0], item: createdRows[0], type: 'render' }, name: 'torrent' }]);
    });

    it('selects the torrent through the handler Lampa\'s search tab attaches', () => {
      const data = createRowData();
      const row = new ProviderResultRow(data);
      let selectedItem: unknown = null;
      let selectCount = 0;
      row.use({
        onInstance: (item, playbackItem) => {
          selectedItem = playbackItem;
          item.use({ onEnter: () => { selectCount++; } });
        },
      });
      row.create();

      createdRows[0].listeners.get('hover:enter')!();

      assert.equal(selectedItem, data.results[0]);
      assert.equal(selectCount, 1);
    });

    it('hands focus to its own row and passes up, down and back to the search tab', () => {
      const row = new ProviderResultRow(createRowData());
      const moves: string[] = [];
      row.use({
        onBack: () => moves.push('back'),
        onDown: () => moves.push('down'),
        onUp: () => moves.push('up'),
      });
      row.create();

      row.toggle();

      const container = row.render(true);
      assert.deepEqual(collections, [{ container }, { container, focus: createdRows[0][0] }]);
      const controller = controllers.get(toggledControllers[0]);
      assert.equal(controller.link, row);
      controller.up();
      controller.down();
      controller.back();
      assert.deepEqual(moves, ['up', 'down', 'back']);
    });

    it('shows the viewed marker for a torrent marked as viewed, including after it returns', () => {
      storageMap.set('torrents_view', ['row-hash']);
      const data = createRowData();
      const row = new ProviderResultRow(data);
      row.create();

      assert.equal(createdRows[0].appendedMarkup.length, 1);
      assert.equal(data.results[0].viewed, true);

      storageMap.set('torrents_view', []);
      row.toggle();

      assert.equal(createdRows[0].appendedMarkup.length, 0);
      assert.equal(data.results[0].viewed, false);
    });

    it('offers viewed actions on long press, lets other menus join in, and applies the choice', () => {
      const data = createRowData();
      const row = new ProviderResultRow(data);
      row.create();
      sentEvents.length = 0;

      createdRows[0].listeners.get('hover:long')!();

      assert.equal(sentEvents[0].name, 'torrent');
      assert.equal(sentEvents[0].event.type, 'onlong');
      assert.equal(sentEvents[0].event.element, data.results[0]);
      assert.equal(sentEvents[0].event.menu, shownSelect.items);
      assert.deepEqual(sentEvents[0].event.movie, { title: data.results[0].Title });
      const markItem = shownSelect.items.find((item: any) => item.mark);
      shownSelect.onSelect(markItem);
      assert.deepEqual(storageMap.get('torrents_view'), ['row-hash']);
      assert.equal(createdRows[0].appendedMarkup.length, 1);
      assert.deepEqual(toggledControllers, ['search_results']);

      const unmarkItem = shownSelect.items.find((item: any) => item.unmark);
      shownSelect.onSelect(unmarkItem);
      assert.deepEqual(storageMap.get('torrents_view'), []);
      assert.equal(createdRows[0].appendedMarkup.length, 0);
    });

    it('returns focus where it was when the long-press menu is dismissed', () => {
      const row = new ProviderResultRow(createRowData());
      row.create();
      createdRows[0].listeners.get('hover:long')!();

      shownSelect.onBack();

      assert.deepEqual(toggledControllers, ['search_results']);
    });

    it('removes its element when destroyed', () => {
      const row = new ProviderResultRow(createRowData());
      row.create();
      const container = row.render(true) as unknown as FakeElement;

      row.destroy();

      assert.equal(container.isRemoved, true);
    });

    it('is built by the factory attached to a row', () => {
      const data = createRowData();
      attachRowFactory(data);

      assert.ok(data.params!.createInstance(data) instanceof ProviderResultRow);
    });
  });
});
