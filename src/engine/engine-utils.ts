// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

/**
 * Closes any active Lampa modal, tolerating the native implementation throwing
 * when no modal is currently open.
 */
export function closeModalSafely(): void {
  if (typeof Lampa === 'undefined' || !Lampa.Modal || typeof Lampa.Modal.close !== 'function') return;
  try {
    Lampa.Modal.close();
  } catch {}
}

export function markTorrentViewed(torrentItem?: LampaTorrentItem): void {
  const viewedHash = torrentItem?.hash;
  if (!viewedHash || typeof Lampa === 'undefined' || !Lampa.Storage) return;

  const viewedList = Lampa.Storage.get<string[]>('torrents_view', []);
  if (!viewedList.includes(viewedHash)) {
    Lampa.Storage.set('torrents_view', [...viewedList, viewedHash]);
  }
  torrentItem.viewed = true;
}

const WATCHED_HISTORY_STORAGE_KEY = 'online_watched_last';

/**
 * Records the played file as the card's last watched entry, in the shape Lampa's own torrent
 * file list stores it. A card's watched overlay only looks up timeline progress for the show's
 * newest season and falls back to this entry otherwise, so without it an older season shows
 * whatever episode was recorded last.
 */
export function recordWatchedHistory(
  card: LampaMovie,
  playedItem: { episode?: number | null, season?: number | null }
): void {
  if (card.id === undefined || typeof Lampa === 'undefined' || !Lampa.Storage || !Lampa.Utils?.hash) return;

  // Lampa fills a show's original_title from its original_name, so this is the title the
  // overlay hashes when it reads the entry back.
  const historyTitle = card.original_name || card.original_title;
  if (!historyTitle) return;

  const storedHistory = Lampa.Storage.get<Record<string, Record<string, unknown>>>(WATCHED_HISTORY_STORAGE_KEY, {});
  const watchedHistory = storedHistory && typeof storedHistory === 'object' ? storedHistory : {};
  const historyKey = String(Lampa.Utils.hash(historyTitle));
  const entry: Record<string, unknown> = { ...watchedHistory[historyKey], balanser_name: 'Torrent' };
  if (card.original_name) {
    entry.episode = playedItem.episode;
    entry.season = playedItem.season;
  }

  Lampa.Storage.set(WATCHED_HISTORY_STORAGE_KEY, { ...watchedHistory, [historyKey]: entry });
}
