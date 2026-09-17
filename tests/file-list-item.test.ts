// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ParsedFileInfo } from '../src/types/torrplay';
import { buildFileListItemElement } from '../src/ui/file-list-item';

describe('buildFileListItemElement', () => {
  const originalLampa = (globalThis as any).Lampa;
  const originalDollar = (globalThis as any).$;

  const makeElement = (): any => {
    const listeners: Record<string, () => void> = {};
    const children: any[] = [];
    const el: any = {
      addClass: (_cls: string) => el,
      append: (child: any) => { children.push(child); return el; },
      attr: (_name: string) => 'lazy.jpg',
      children,
      find: (_selector: string) => el,
      on: (eventName: string, callback: () => void) => { listeners[eventName] = callback; return el; },
      __listeners: listeners,
    };
    el[0] = { style: {} };
    return el;
  };

  beforeEach(() => {
    (globalThis as any).$ = (_html?: string) => makeElement();
  });

  afterEach(() => {
    if (originalLampa) {
      (globalThis as any).Lampa = originalLampa;
    } else {
      delete (globalThis as any).Lampa;
    }
    (globalThis as any).$ = originalDollar;
  });

  const fileInfo: ParsedFileInfo = { episode: 3, hash: 'h', season: 1, serial: true };

  it('renders the plain torrent_file template (no image) when there is no episode preview', () => {
    const calls: Array<{ data: any, name: string }> = [];
    (globalThis as any).Lampa = {
      Template: {
        get: (name: string, data: any) => { calls.push({ data, name }); return makeElement(); },
      },
      Timeline: { render: () => makeElement() },
    };

    const element = buildFileListItemElement({
      exe: 'mkv',
      fileInfo,
      size: '700 MB',
      timeline: { hash: 'h' },
      title: 'Episode Title',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'torrent_file');
    assert.deepEqual(calls[0].data, { exe: 'mkv', size: '700 MB', title: 'Episode Title' });
    assert.equal(element.children.length, 1, 'timeline should be appended to the plain row');
  });

  it('renders the torrent_file_serial template with the still image, episode number, and air date when a preview is available', () => {
    const calls: Array<{ data: any, name: string }> = [];
    (globalThis as any).Lampa = {
      Template: {
        get: (name: string, data: any) => { calls.push({ data, name }); return makeElement(); },
      },
      Timeline: { render: () => makeElement() },
    };

    const element: any = buildFileListItemElement({
      exe: 'mkv',
      fileInfo,
      preview: { airDate: '2 January 2020', img: 'https://image.tmdb.org/still.jpg', title: 'The Pilot' },
      size: '700 MB',
      timeline: { hash: 'h' },
      title: 'Episode Title',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'torrent_file_serial');
    assert.deepEqual(calls[0].data, {
      air_date: '2 January 2020',
      episode: 3,
      exe: 'mkv',
      fname: 'The Pilot',
      img: 'https://image.tmdb.org/still.jpg',
      season: 1,
      size: '700 MB',
    });
    assert.equal(element[0].visibility, 'hidden', 'the row must start hidden for Lampa\'s lazy visibility system');
    assert.ok(typeof element.__listeners.visible === 'function', 'a visible handler must be registered for lazy image loading');
  });

  it('falls back to the plain title when the preview has no episode name', () => {
    const calls: Array<{ data: any, name: string }> = [];
    (globalThis as any).Lampa = {
      Template: {
        get: (name: string, data: any) => { calls.push({ data, name }); return makeElement(); },
      },
      Timeline: { render: () => makeElement() },
    };

    buildFileListItemElement({
      exe: 'mkv',
      fileInfo,
      preview: { airDate: '', img: './img/img_broken.svg', title: '' },
      size: '700 MB',
      title: 'Fallback Title',
    });

    assert.equal(calls[0].data.fname, 'Fallback Title');
  });

  it('assigns the lazy-loaded image src from data-src once the row becomes visible', () => {
    (globalThis as any).Lampa = {
      Template: {
        get: () => makeElement(),
      },
    };

    const element: any = buildFileListItemElement({
      exe: 'mkv',
      fileInfo,
      preview: { airDate: '', img: 'https://image.tmdb.org/still.jpg', title: 'The Pilot' },
      size: '700 MB',
      title: 'Episode Title',
    });

    element.__listeners.visible();

    const image = element.find('img');
    assert.equal(image[0].src, 'lazy.jpg');
    assert.equal(image[0].style.objectFit, 'cover');
  });
});
