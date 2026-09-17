// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { initPlayerPlaylist, rememberPlayerPlaylist, resetPlayerPlaylistForTesting } from '../src/engine/player-playlist';

describe('player playlist', () => {
  const originalLampa = (globalThis as any).Lampa;
  let createListeners: Array<(event: any) => void>;
  let lampaPlaylist: any[];

  beforeEach(() => {
    createListeners = [];
    lampaPlaylist = [];
    (globalThis as any).Lampa = {
      Player: { listener: { follow: (name: string, listener: any) => { if (name === 'create') createListeners.push(listener); } } },
      PlayerPlaylist: { get: () => lampaPlaylist, set: (playlist: any[]) => { lampaPlaylist = playlist; } },
    };
    resetPlayerPlaylistForTesting();
    initPlayerPlaylist();
  });

  afterEach(() => {
    resetPlayerPlaylistForTesting();
    (globalThis as any).Lampa = originalLampa;
  });

  const create = (item: any) => createListeners.forEach(listener => listener({ abort: () => {}, data: item }));

  it('puts the playlist back while Lampa has emptied it for an episode switch', () => {
    const playlist = [{ title: 'e01' }, { title: 'e02' }];
    rememberPlayerPlaylist(playlist);

    create(playlist[1]);

    assert.equal(lampaPlaylist, playlist);
  });

  it('leaves a playlist Lampa already holds alone', () => {
    const playlist = [{ title: 'e01' }, { title: 'e02' }];
    const otherPlaylist = [{ title: 'other' }];
    rememberPlayerPlaylist(playlist);
    lampaPlaylist = otherPlaylist;

    create(playlist[1]);

    assert.equal(lampaPlaylist, otherPlaylist);
  });

  it('ignores playback that is not from the playlist TorrPlay handed over', () => {
    rememberPlayerPlaylist([{ title: 'e01' }]);

    create({ title: 'online video' });

    assert.deepEqual(lampaPlaylist, []);
  });
});
