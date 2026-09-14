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
