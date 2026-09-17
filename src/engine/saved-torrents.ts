// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { extractHashFromMagnet, normalizeInfoHash, TorrPlayApi } from '../api/torrplay';
import { InstanceManager } from '../instances/instance-manager';
import { Torrent } from '../types/torrplay';

// GET /api/v1/torrents lists the database rows together with every torrent merely loaded
// in the torrent client, so a listing entry is not proof of persistence on its own. Only
// a database row carries the creation stamp the server writes when it stores the torrent.
export function isPersistedTorrent(torrent: Pick<Torrent, 'created_at'>): boolean {
  return typeof torrent.created_at === 'string' && torrent.created_at.trim().length > 0;
}

/**
 * Resolves the info hash of a torrent search result, preferring the fields providers fill
 * in directly and falling back to the one carried by a magnet link.
 */
export function resolveTorrentItemHash(torrentItem?: LampaTorrentItem): string | null {
  if (!torrentItem) return null;

  const rawSource = (
    torrentItem.MagnetUri ||
    torrentItem.Link ||
    torrentItem.link ||
    torrentItem.url ||
    ''
  ).trim();
  const magnetHash = rawSource.toLowerCase().startsWith('magnet:')
    ? extractHashFromMagnet(rawSource)
    : null;

  return (
    normalizeInfoHash(torrentItem.info_hash) ||
    normalizeInfoHash(torrentItem.InfoHash) ||
    magnetHash ||
    normalizeInfoHash(torrentItem.hash) ||
    normalizeInfoHash(torrentItem.Hash)
  );
}

const LOOKUP_DEBOUNCE_MS = 300;
const LOOKUP_CHUNK_SIZE = 40;

/**
 * Tracks which torrents are already stored in the active instance's database.
 *
 * Lampa builds a torrent card's context menu synchronously, so the menu can only react to
 * what is already known by the time it opens. Card rendering queues a lookup, which the
 * server answers for a whole batch of hashes at once, and the answers stay cached for the
 * menu to read back without blocking.
 */
export class SavedTorrents {
  private static isRegistered = false;
  private static instanceId: string | null = null;
  private static readonly savedByHash = new Map<string, boolean>();
  private static readonly queuedHashes = new Set<string>();
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  // Bumped whenever the cache is dropped, so an in-flight lookup can tell that its answers
  // describe a database that is no longer the one being tracked.
  private static generation = 0;

  /**
   * Drops the cache whenever request routing moves to another instance. Nothing else forces a
   * re-lookup: a hash that is already cached is never queued again, so a pool that keeps
   * serving the same cards would otherwise answer from the previous instance's database
   * indefinitely.
   */
  public static init(): void {
    if (this.isRegistered) return;
    this.isRegistered = true;
    InstanceManager.onSelectionChanged(() => this.reset());
  }

  /**
   * Returns whether the torrent is stored in the database, or undefined while that is
   * still unknown — callers treat an unknown torrent as if it were not stored yet.
   */
  public static isSaved(hash?: string | null): boolean | undefined {
    const normalized = normalizeInfoHash(hash);
    if (!normalized) return undefined;
    return this.savedByHash.get(normalized);
  }

  /**
   * Records a torrent as stored. Failover can write to an instance other than the one being
   * tracked, so the instance that actually answered is named to keep the cache attributed to
   * the right database.
   */
  public static markSaved(hash?: string | null, instanceId?: string): void {
    this.mark(hash, true, instanceId);
  }

  public static markUnsaved(hash?: string | null, instanceId?: string): void {
    this.mark(hash, false, instanceId);
  }

  private static mark(hash: string | null | undefined, isSaved: boolean, instanceId?: string): void {
    const normalized = normalizeInfoHash(hash);
    if (!normalized) return;
    this.useInstance(instanceId);
    this.savedByHash.set(normalized, isSaved);
    this.queuedHashes.delete(normalized);
  }

  /**
   * Records what a listing already answered, so a browsed database needs no extra lookups.
   */
  public static syncFromListing(instanceId: string | undefined, torrents: Torrent[]): void {
    this.useInstance(instanceId);
    torrents.forEach(torrent => {
      const normalized = normalizeInfoHash(torrent.hash);
      if (!normalized) return;
      this.savedByHash.set(normalized, isPersistedTorrent(torrent));
      this.queuedHashes.delete(normalized);
    });
  }

  /**
   * Schedules a server lookup for a hash whose state is not cached yet.
   */
  public static queueLookup(hash?: string | null): void {
    const normalized = normalizeInfoHash(hash);
    if (!normalized || this.savedByHash.has(normalized)) return;

    this.queuedHashes.add(normalized);
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, LOOKUP_DEBOUNCE_MS);
  }

  /**
   * Drops everything cached for a previous instance, since database contents are per-instance.
   */
  public static reset(): void {
    this.generation += 1;
    this.instanceId = null;
    this.savedByHash.clear();
    this.queuedHashes.clear();
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private static useInstance(instanceId?: string): void {
    if (!instanceId || this.instanceId === instanceId) {
      if (instanceId) this.instanceId = instanceId;
      return;
    }
    const queued = [...this.queuedHashes];
    this.reset();
    queued.forEach(hash => this.queuedHashes.add(hash));
    this.instanceId = instanceId;
  }

  private static async flush(): Promise<void> {
    this.flushTimer = null;

    const hashes = [...this.queuedHashes];
    this.queuedHashes.clear();
    if (hashes.length === 0) return;

    try {
      const instance = await InstanceManager.getBestInstance();
      this.useInstance(instance.id);
      const generation = this.generation;

      for (let offset = 0; offset < hashes.length; offset += LOOKUP_CHUNK_SIZE) {
        // A reset that landed mid-lookup means these answers describe a database that is no
        // longer in use; recording them would resurrect the cache it just dropped.
        if (this.generation !== generation) return;
        const chunk = hashes.slice(offset, offset + LOOKUP_CHUNK_SIZE);
        try {
          // The limit caps the response should the server not know the filter and answer
          // with the whole listing instead.
          const response = await TorrPlayApi.getTorrents(instance, {
            hashes: chunk,
            limit: chunk.length,
          });
          const persisted = new Set(
            (response.torrents || [])
              .filter(torrent => isPersistedTorrent(torrent))
              .map(torrent => normalizeInfoHash(torrent.hash))
              .filter((hash): hash is string => Boolean(hash))
          );
          chunk.forEach(hash => this.savedByHash.set(hash, persisted.has(hash)));
        } catch {
          // One failed chunk says nothing about the rest, so its hashes go back in the queue
          // for a later render to retry while the remaining chunks still get their answer.
          chunk.forEach(hash => this.queuedHashes.add(hash));
        }
      }
    } catch {
      // No reachable instance at all: the hashes were never asked about, so they go back in
      // the queue rather than being silently dropped as if they had been answered.
      hashes.forEach(hash => this.queuedHashes.add(hash));
    }
  }
}
