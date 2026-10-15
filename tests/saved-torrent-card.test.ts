// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { Torrent } from '../src/types/torrplay';
import {
  buildSavedTorrentCard,
  describeViewedAction,
  setSavedTorrentCardViewed,
  summarizeSavedTorrent,
  TORRPLAY_ACTIVE_BADGE,
  TORRPLAY_STORAGE_BADGE,
  WatchedOverlayScheduler,
} from '../src/ui/saved-torrent-card';
import { FakeCardElement, installFakeJquery } from './support/fake-card-element';
import { createTestLanguage, getTestTranslation } from './support/translations';

const torrent: Torrent = {
  active: true,
  created_at: '2026-10-11T00:00:00Z',
  files: [
    { length: 100, name: 'Show.S01E01.mkv', path: 'Show/Show.S01E01.mkv' },
    { length: 100, name: 'Show.S01E02.mkv', path: 'Show/Show.S01E02.mkv' },
  ],
  hash: 'a'.repeat(40),
  magnet: 'magnet:?xt=urn:btih:aaaa',
  name: 'Show.S01.1080p',
  poster: 'https://images.local/poster.jpg',
  storage: 'file',
  title: '<b>Show</b> Season 1',
  total_size: 2048,
};

describe('Saved Torrent Cards', () => {
  let cards: FakeCardElement[];

  beforeEach(() => {
    cards = installFakeJquery();
    (globalThis as any).Lampa = {
      Lang: { translate: (key: string) => (key.startsWith('torrent_parser_') ? `t:${key}` : createTestLanguage().translate(key)) },
      Storage: { field: () => true },
      Utils: {
        bytesToSize: (bytes: number) => `${bytes} B`,
        clearHtmlTags: (text: string) => text.replace(/<[^>]*>/g, ''),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).$;
    mock.timers.reset();
  });

  it('keeps only what the card shows, so a cached search row stays small', () => {
    assert.deepEqual(summarizeSavedTorrent(torrent), {
      active: true,
      files: torrent.files.map(file => ({ length: file.length, name: file.name, path: file.path })),
      hash: torrent.hash,
      name: torrent.name,
      poster: torrent.poster,
      storage: 'file',
      title: torrent.title,
      total_size: 2048,
    });
  });

  it('builds the library card with its badges, markup-free title, and size and file count', () => {
    buildSavedTorrentCard(torrent, false);

    const { markup } = cards[0];
    assert.ok(markup.includes(TORRPLAY_ACTIVE_BADGE));
    assert.ok(markup.includes(TORRPLAY_STORAGE_BADGE));
    assert.ok(markup.includes('<div class="card__title">Show Season 1</div>'));
    assert.ok(markup.includes(`<div class="card__age">2048 B · ${getTestTranslation('torrplay_card_file_count', { count: 2 })}</div>`));
    assert.ok(!markup.includes('card__icon--viewed'));
    assert.equal(cards[0].image.src, torrent.poster);
  });

  it('leaves out the badges a torrent does not earn and falls back to the broken poster image', () => {
    buildSavedTorrentCard({ ...torrent, active: false, poster: undefined, storage: 'memory' }, true);

    const card = cards[0];
    assert.ok(!card.markup.includes(TORRPLAY_ACTIVE_BADGE));
    assert.ok(!card.markup.includes(TORRPLAY_STORAGE_BADGE));
    assert.ok(card.markup.includes('card__icon--viewed'));
    assert.equal(card.image.src, './img/img_broken.svg');
    assert.ok(card.classes.has('card--loaded'));
  });

  it('swaps in the broken poster image when the poster fails to load', () => {
    buildSavedTorrentCard(torrent, false);

    cards[0].image.onerror!();

    assert.equal(cards[0].image.src, './img/img_broken.svg');
  });

  it('adds and removes the viewed icon', () => {
    const card = buildSavedTorrentCard(torrent, false);

    setSavedTorrentCardViewed(card, true);
    assert.equal(cards[0].isViewed, true);
    setSavedTorrentCardViewed(card, false);
    assert.equal(cards[0].isViewed, false);
  });

  it('offers only the viewed action that applies, in Lampa\'s own words', () => {
    assert.deepEqual(describeViewedAction(false), {
      action: 'mark',
      subtitle: 't:torrent_parser_label_descr',
      title: 't:torrent_parser_label_title',
    });
    assert.deepEqual(describeViewedAction(true), {
      action: 'unmark',
      subtitle: 't:torrent_parser_label_cancel_descr',
      title: 't:torrent_parser_label_cancel_title',
    });
  });

  describe('WatchedOverlayScheduler', () => {
    beforeEach(() => {
      mock.timers.enable({ apis: ['setTimeout'] });
      (globalThis as any).Lampa.Timeline = {
        render: () => 'timeline',
        view: () => ({ percent: 40, time: 0, updated: 1 }),
      };
      (globalThis as any).Lampa.Template = { get: () => ({ find: () => ({ append: () => {} }) }) };
    });

    it('shows watched progress on a card that keeps focus', () => {
      const card = buildSavedTorrentCard(torrent, false);
      cards[0].classes.add('focus');
      const scheduler = new WatchedOverlayScheduler();

      scheduler.schedule(card, torrent);
      mock.timers.tick(500);

      assert.equal(cards[0].overlays.length, 1);
    });

    it('skips a card that has lost focus by then, or that a canceled schedule left', () => {
      const card = buildSavedTorrentCard(torrent, false);
      const scheduler = new WatchedOverlayScheduler();

      scheduler.schedule(card, torrent);
      mock.timers.tick(500);
      assert.equal(cards[0].overlays.length, 0);

      cards[0].classes.add('focus');
      scheduler.schedule(card, torrent);
      scheduler.cancel();
      mock.timers.tick(500);
      assert.equal(cards[0].overlays.length, 0);
    });
  });
});
