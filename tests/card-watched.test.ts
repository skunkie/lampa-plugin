// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { buildCardWatchedElement, findLatestFileProgress } from '../src/ui/card-watched';

describe('card watched overlay', () => {
  const originalLampa = (globalThis as any).Lampa;
  const originalDollar = (globalThis as any).$;

  const makeElement = (html = ''): any => {
    const el: any = {
      append: (child: any) => { el.children.push(child); return el; },
      children: [] as any[],
      find: (_selector: string) => el,
      html,
      text: (value: string) => { el.textValue = value; return el; },
      textValue: '',
    };
    return el;
  };

  let timelines: Record<string, any>;

  beforeEach(() => {
    timelines = {};
    (globalThis as any).$ = (html?: string) => makeElement(html);
    (globalThis as any).Lampa = {
      Lang: { translate: (key: string) => ({ full_episode: 'Episode', title_viewed: 'Viewed' } as any)[key] },
      Template: { get: (name: string) => makeElement(name) },
      Timeline: {
        render: (view: any) => ({ rendered: view }),
        view: (hash: string) => timelines[hash] || { hash, percent: 0, time: 0 },
      },
      Utils: {
        hash: (value: string) => value,
        secondsToTimeHuman: (seconds: number) => `${seconds}s`,
      },
    };
  });

  afterEach(() => {
    (globalThis as any).Lampa = originalLampa;
    (globalThis as any).$ = originalDollar;
  });

  const showTorrent: any = {
    files: [
      { length: 1, name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
      { length: 1, name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
      { length: 1, name: 'notes.txt', path: 'notes.txt' },
    ],
    hash: 'abc',
    name: 'Show S01',
  };
  const showCard: any = { number_of_seasons: 1, original_name: 'Show', original_title: 'Show' };

  it('picks the most recently updated watched file', () => {
    timelines['11Show'] = { hash: '11Show', percent: 80, time: 1200, updated: 2000 };
    timelines['12Show'] = { hash: '12Show', percent: 10, time: 100, updated: 1000 };

    const progress = findLatestFileProgress(showTorrent, showCard);

    assert.ok(progress);
    assert.equal(progress.fileInfo.episode, 1);
    assert.equal(progress.view.percent, 80);
  });

  it('returns nothing when no file has progress', () => {
    assert.equal(findLatestFileProgress(showTorrent, showCard), undefined);
  });

  it('labels an episode by its number', () => {
    const element: any = buildCardWatchedElement({
      fileInfo: { episode: 2, hash: 'h', season: 1, serial: true },
      view: { hash: 'h', percent: 40, time: 600 },
    });

    assert.equal(element.html, 'card_watched');
    const item = element.children[0];
    assert.equal(item.children[0].textValue, 'Episode 2');
    assert.deepEqual(item.children[1], { rendered: { hash: 'h', percent: 40, time: 600 } });
  });

  it('labels a movie by watched time, or by percent when no time is stored', () => {
    const movieInfo = { episode: null, hash: 'm', season: null, serial: false };

    const timed: any = buildCardWatchedElement({ fileInfo: movieInfo, view: { hash: 'm', percent: 35, time: 2400 } });
    assert.equal(timed.children[0].children[0].textValue, 'Viewed 2400s');

    const percentOnly: any = buildCardWatchedElement({ fileInfo: movieInfo, view: { hash: 'm', percent: 35 } });
    assert.equal(percentOnly.children[0].children[0].textValue, 'Viewed 35%');
  });
});
