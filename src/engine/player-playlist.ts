// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

/**
 * Lampa skips its preroll ad for an item that is continuing a playlist, which it recognises
 * only while that item is in the player's current playlist. Switching episodes inside the
 * player tears the player down first, which empties that playlist, and restores it only after
 * the next episode has passed the ad check. Lampa announces each playback before that check,
 * so the playlist TorrPlay handed over is put back at that point.
 */
let torrPlayPlaylist: LampaPlayerItem[] = [];
let isInitialized = false;

export function rememberPlayerPlaylist(playlist: LampaPlayerItem[]): void {
  torrPlayPlaylist = playlist;
}

export function initPlayerPlaylist(): void {
  if (isInitialized || typeof Lampa === 'undefined' || !Lampa.Player?.listener) return;
  isInitialized = true;

  Lampa.Player.listener.follow('create', (event: { data?: unknown }) => {
    const item = event?.data as LampaPlayerItem | undefined;
    if (!item || !torrPlayPlaylist.includes(item)) return;

    const playerPlaylist = Lampa.PlayerPlaylist;
    if (!playerPlaylist || playerPlaylist.get().length > 0) return;
    playerPlaylist.set(torrPlayPlaylist);
  });
}

export function resetPlayerPlaylistForTesting(): void {
  torrPlayPlaylist = [];
  isInitialized = false;
}
