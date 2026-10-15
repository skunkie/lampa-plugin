// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { TorrPlayApi } from '../src/api/torrplay';
import { SavedTorrents } from '../src/engine/saved-torrents';
import { InstanceManager } from '../src/instances/instance-manager';
import { TorrentsResponse, TorrPlayInstance } from '../src/types/torrplay';

describe('Saved torrent database scope', () => {
  const originalLampa = (globalThis as any).Lampa;
  const hash = 'a'.repeat(40);

  beforeEach(() => {
    const values = new Map<string, unknown>();
    (globalThis as any).Lampa = {
      Storage: {
        get: (key: string, fallback: unknown) => values.has(key) ? values.get(key) : fallback,
        set: (key: string, value: unknown) => values.set(key, value),
      },
    };
    (InstanceManager as any).isInitialized = false;
    (InstanceManager as any).selectionListeners.length = 0;
    InstanceManager.init();
    (SavedTorrents as any).isRegistered = false;
    SavedTorrents.init();
    SavedTorrents.reset();
    mock.timers.enable({ apis: ['setTimeout'] });
    mock.method(InstanceManager, 'getBestInstance', async () => InstanceManager.getPrimaryInstance());
  });

  afterEach(() => {
    SavedTorrents.reset();
    mock.timers.reset();
    mock.restoreAll();
    (InstanceManager as any).selectionListeners.length = 0;
    (SavedTorrents as any).isRegistered = false;
    (globalThis as any).Lampa = originalLampa;
  });

  it('invalidates cached answers when pool membership or an instance URL changes', () => {
    const instance = InstanceManager.getPrimaryInstance();
    SavedTorrents.markSaved(hash, instance.id);
    InstanceManager.addInstance({ authType: 'none', id: 'other', name: 'Other', url: 'http://other.local' });
    assert.equal(SavedTorrents.isSaved(hash), undefined);

    SavedTorrents.markSaved(hash, instance.id);
    instance.url = 'http://new-database.local';
    InstanceManager.updateInstance(instance);
    assert.equal(SavedTorrents.isSaved(hash), undefined);
  });

  for (const shouldResolveInReverse of [false, true]) {
    it(`resolves overlapping batches for the same database in ${shouldResolveInReverse ? 'reverse' : 'request'} order`, async () => {
      const instance = InstanceManager.getPrimaryInstance();
      const firstHash = 'b'.repeat(40);
      const secondHash = 'c'.repeat(40);
      const selections: Array<() => void> = [];
      mock.method(InstanceManager, 'getBestInstance', () => new Promise<typeof instance>(resolve => {
        selections.push(() => resolve(instance));
      }));
      const listing = mock.method(TorrPlayApi, 'getTorrents', async (_instance: TorrPlayInstance, options?: { hashes?: string[] }) => ({
        torrents: (options?.hashes || []).map(hash => ({
          created_at: '2026-10-12',
          files: [],
          hash,
          name: 'Saved',
          storage: 'memory' as const,
          total_size: 0,
        })),
      }));

      SavedTorrents.queueLookup(firstHash);
      mock.timers.tick(300);
      SavedTorrents.queueLookup(secondHash);
      mock.timers.tick(300);
      assert.equal(selections.length, 2);

      const selectionOrder = shouldResolveInReverse ? [1, 0] : [0, 1];
      for (const index of selectionOrder) {
        selections[index]();
        await new Promise<void>(resolve => setImmediate(resolve));
      }

      assert.equal(listing.mock.callCount(), 2);
      assert.equal(SavedTorrents.isSaved(firstHash), true);
      assert.equal(SavedTorrents.isSaved(secondHash), true);
    });
  }

  for (const shouldReject of [false, true]) {
    it(`discards a ${shouldReject ? 'failed' : 'successful'} lookup that finishes after routing changes`, async () => {
      let finishLookup: () => void = () => {};
      let announceStart: () => void = () => {};
      const started = new Promise<void>(resolve => { announceStart = resolve; });
      mock.method(TorrPlayApi, 'getTorrents', () => new Promise<TorrentsResponse>((resolve, reject) => {
        announceStart();
        finishLookup = () => {
          if (shouldReject) reject(new Error('Old database is unavailable'));
          else resolve({ torrents: [{ created_at: '2026-10-12', files: [], hash, name: 'Saved', storage: 'memory', total_size: 0 }] });
        };
      }));

      SavedTorrents.queueLookup(hash);
      mock.timers.tick(300);
      await started;
      InstanceManager.setSelectedId('another-instance');
      finishLookup();
      await new Promise<void>(resolve => setImmediate(resolve));

      assert.equal(SavedTorrents.isSaved(hash), undefined);
      assert.equal((SavedTorrents as any).queuedHashes.size, 0);
    });
  }

  it('keeps queued lookups scheduled when a pending batch selects another database', async () => {
    const originalInstance = InstanceManager.getPrimaryInstance();
    const nextInstance = { ...originalInstance, id: 'next', url: 'http://next.local' };
    const firstHash = 'd'.repeat(40);
    const queuedHash = 'e'.repeat(40);
    SavedTorrents.markSaved(hash, originalInstance.id);
    let finishSelection: () => void = () => {};
    const selection = mock.method(InstanceManager, 'getBestInstance', () => new Promise<typeof nextInstance>(resolve => {
      finishSelection = () => resolve(nextInstance);
    }));
    const listing = mock.method(TorrPlayApi, 'getTorrents', async (_instance: TorrPlayInstance, options?: { hashes?: string[] }) => ({
      torrents: (options?.hashes || []).map(hash => ({
        created_at: '2026-10-12', files: [], hash, name: 'Saved', storage: 'memory' as const, total_size: 0,
      })),
    }));

    SavedTorrents.queueLookup(firstHash);
    mock.timers.tick(300);
    SavedTorrents.queueLookup(queuedHash);
    finishSelection();
    await new Promise<void>(resolve => setImmediate(resolve));
    selection.mock.restore();
    mock.method(InstanceManager, 'getBestInstance', async () => nextInstance);
    mock.timers.tick(300);
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.equal(listing.mock.callCount(), 2);
    assert.equal(SavedTorrents.isSaved(hash), undefined);
    assert.equal(SavedTorrents.isSaved(firstHash), true);
    assert.equal(SavedTorrents.isSaved(queuedHash), true);
  });

  for (const isSaved of [false, true]) {
    for (const shouldReject of [false, true]) {
      it(`keeps a newer ${isSaved ? 'save' : 'deletion'} when an older lookup ${shouldReject ? 'fails' : 'succeeds'}`, async () => {
        const instance = InstanceManager.getPrimaryInstance();
        let finishLookup: () => void = () => {};
        let announceStart: () => void = () => {};
        const started = new Promise<void>(resolve => { announceStart = resolve; });
        mock.method(TorrPlayApi, 'getTorrents', () => new Promise<TorrentsResponse>((resolve, reject) => {
          announceStart();
          finishLookup = () => {
            if (shouldReject) reject(new Error('Lookup failed'));
            else resolve({
              torrents: isSaved ? [] : [{ created_at: '2026-10-12', files: [], hash, name: 'Saved', storage: 'memory', total_size: 0 }],
            });
          };
        }));

        SavedTorrents.queueLookup(hash);
        mock.timers.tick(300);
        await started;
        if (isSaved) SavedTorrents.markSaved(hash, instance.id);
        else SavedTorrents.markUnsaved(hash, instance.id);
        finishLookup();
        await new Promise<void>(resolve => setImmediate(resolve));

        assert.equal(SavedTorrents.isSaved(hash), isSaved);
        assert.equal((SavedTorrents as any).queuedHashes.size, 0);
      });
    }
  }

  it('does not replace a database established while instance selection was pending', async () => {
    const instance = InstanceManager.getPrimaryInstance();
    let finishSelection: () => void = () => {};
    mock.method(InstanceManager, 'getBestInstance', () => new Promise<typeof instance>(resolve => {
      finishSelection = () => resolve(instance);
    }));
    const listing = mock.method(TorrPlayApi, 'getTorrents', async () => ({ torrents: [] }));

    SavedTorrents.queueLookup(hash);
    mock.timers.tick(300);
    SavedTorrents.markSaved(hash, 'failover-instance');
    finishSelection();
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.equal(listing.mock.callCount(), 0);
    assert.equal(SavedTorrents.isSaved(hash), true);
  });

  it('keeps the rest of a batch queued when a save claims another database during instance selection', async () => {
    const instance = InstanceManager.getPrimaryInstance();
    const otherHash = 'b'.repeat(40);
    let finishSelection: () => void = () => {};
    mock.method(InstanceManager, 'getBestInstance', () => new Promise<typeof instance>(resolve => {
      finishSelection = () => resolve(instance);
    }));
    mock.method(TorrPlayApi, 'getTorrents', async () => ({ torrents: [] }));

    SavedTorrents.queueLookup(hash);
    SavedTorrents.queueLookup(otherHash);
    mock.timers.tick(300);
    SavedTorrents.markSaved(hash, 'failover-instance');
    finishSelection();
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.deepEqual([...(SavedTorrents as any).queuedHashes], [otherHash]);
    assert.notEqual((SavedTorrents as any).flushTimer, null, 'the requeued hash needs a lookup scheduled');
  });

  for (const shouldReject of [false, true]) {
    it(`discards pending instance selection that ${shouldReject ? 'fails' : 'succeeds'} after routing changes`, async () => {
      const instance = InstanceManager.getPrimaryInstance();
      let finishSelection: () => void = () => {};
      let announceStart: () => void = () => {};
      const started = new Promise<void>(resolve => { announceStart = resolve; });
      mock.method(InstanceManager, 'getBestInstance', () => new Promise<typeof instance>((resolve, reject) => {
        announceStart();
        finishSelection = () => {
          if (shouldReject) reject(new Error('No reachable instances'));
          else resolve(instance);
        };
      }));
      const listing = mock.method(TorrPlayApi, 'getTorrents', async () => ({ torrents: [] }));

      SavedTorrents.queueLookup(hash);
      mock.timers.tick(300);
      await started;
      InstanceManager.setSelectedId('another-instance');
      finishSelection();
      await new Promise<void>(resolve => setImmediate(resolve));

      assert.equal(listing.mock.callCount(), 0);
      assert.equal((SavedTorrents as any).queuedHashes.size, 0);
    });
  }
});
