// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { translate } from '../lang/translations';
import { Torrent } from '../types/torrplay';
import { buildCardWatchedElement, findLatestFileProgress } from './card-watched';

/**
 * What a saved torrent's card shows. A card in global search is cached by Lampa as plain
 * data, so it keeps only these fields rather than the whole torrent.
 */
export type SavedTorrentSummary = Pick<Torrent, 'active' | 'files' | 'hash' | 'name' | 'poster' | 'storage' | 'title' | 'total_size'>;

export type ViewedAction = 'mark' | 'unmark';

const WATCHED_OVERLAY_DELAY_MS = 500;

export const TORRPLAY_STORAGE_BADGE_ICON = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display: block;">
  <path d="M10 16h.01"/>
  <path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  <path d="M21.946 12.013H2.054"/>
  <path d="M6 16h.01"/>
</svg>
`.trim();

export const TORRPLAY_ACTIVE_BADGE = `
<div class="card__type card__type--active" data-testid="active-torrent-badge" title="Active" style="position: absolute; top: 0.5em; right: auto; left: 0.5em; z-index: 10; display: flex; align-items: center; justify-content: center; padding: 0.35em; color: #fff; pointer-events: none; background: rgba(0, 0, 0, 0.6); border-radius: 0.35em; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);"><span class="torrplay-active-dot"><span class="torrplay-active-dot__ping"></span><span class="torrplay-active-dot__core"></span></span></div>
`.trim();

export const TORRPLAY_STORAGE_BADGE = `
<div class="card__type card__type--storage" data-testid="file-storage-badge" title="File Storage" style="position: absolute; top: 0.5em; right: 0.5em; left: auto; z-index: 10; display: flex; align-items: center; justify-content: center; padding: 0.3em; color: #fff; pointer-events: none; background: rgba(0, 0, 0, 0.6); border-radius: 0.35em; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);">${TORRPLAY_STORAGE_BADGE_ICON}</div>
`.trim();

const VIEWED_ICON = `
<div class="card__icon card__icon--viewed">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
</div>
`.trim();

/**
 * Keeps only what a saved torrent's card shows, including the file list its watched progress
 * is read from.
 */
export function summarizeSavedTorrent(torrent: Torrent): SavedTorrentSummary {
  return {
    active: torrent.active,
    files: (torrent.files || []).map(file => ({ length: file.length, name: file.name, path: file.path })),
    hash: torrent.hash,
    name: torrent.name,
    poster: torrent.poster,
    storage: torrent.storage,
    title: torrent.title,
    total_size: torrent.total_size,
  };
}

/**
 * Builds a saved torrent's card in the markup of Lampa's My Torrents grid: the poster, the
 * viewed icon, the active and disk storage badges, and the size and file count under the title.
 */
export function buildSavedTorrentCard(torrent: SavedTorrentSummary, isViewed: boolean): LampaDomElement {
  const totalSizeBytes = torrent.total_size || 0;
  const formattedSize = totalSizeBytes > 0 ? Lampa.Utils.bytesToSize(totalSizeBytes) : '';
  const fileCount = torrent.files ? torrent.files.length : 0;
  // A colon form reads correctly for any count without plural forms.
  const formattedFileCount = translate('torrplay_card_file_count', 'Files: {count}', { count: fileCount });
  const metadataLine = [formattedSize, formattedFileCount].filter(Boolean).join(' · ');
  const cardTitle = Lampa.Utils.clearHtmlTags(torrent.title || torrent.name || '');

  const card = $(`
    <div class="card card--loaded selector layer--visible layer--render">
      <div class="card__view">
        <img src="./img/img_load.svg" class="card__img" />
        <div class="card__icons">
          <div class="card__icons-inner">${isViewed ? VIEWED_ICON : ''}</div>
        </div>
        ${torrent.active === true ? TORRPLAY_ACTIVE_BADGE : ''}
        ${torrent.storage === 'file' ? TORRPLAY_STORAGE_BADGE : ''}
      </div>
      <div class="card__title">${cardTitle}</div>
      <div class="card__age">${metadataLine}</div>
    </div>
  `);

  const posterImage = card.find('.card__img');
  if (torrent.poster) {
    const posterImageElement = posterImage[0] as HTMLImageElement;
    posterImageElement.onload = () => {
      card.addClass('card--loaded');
    };
    posterImageElement.onerror = () => {
      posterImageElement.src = './img/img_broken.svg';
      card.addClass('card--loaded');
    };
    posterImageElement.src = torrent.poster;
  } else {
    posterImage.attr('src', './img/img_broken.svg');
    card.addClass('card--loaded');
  }

  return card;
}

export function setSavedTorrentCardViewed(card: LampaDomElement, isViewed: boolean): void {
  if (!card || typeof card.find !== 'function') return;
  if (!isViewed) {
    card.find('.card__icon--viewed').remove();
    return;
  }
  const iconsInner = card.find('.card__icons-inner');
  if (iconsInner.length && iconsInner.find('.card__icon--viewed').length === 0) {
    iconsInner.append(VIEWED_ICON);
  }
}

/**
 * The menu entry that flips a torrent's viewed mark: only "mark" for an unviewed torrent and
 * only "unmark" for a viewed one, worded with Lampa's own labels.
 */
export function describeViewedAction(isViewed: boolean): { action: ViewedAction, subtitle: string, title: string } {
  const translateLampa = (key: string, fallback: string) => (
    typeof Lampa !== 'undefined' && Lampa.Lang?.translate ? Lampa.Lang.translate(key) : fallback
  );
  return isViewed
    ? {
      action: 'unmark',
      subtitle: translateLampa('torrent_parser_label_cancel_descr', 'Remove view label'),
      title: translateLampa('torrent_parser_label_cancel_title', 'Remove label'),
    }
    : {
      action: 'mark',
      subtitle: translateLampa('torrent_parser_label_descr', 'Mark torrent as viewed'),
      title: translateLampa('torrent_parser_label_title', 'Label'),
    };
}

/**
 * Shows a card's watched progress once the card has kept focus for a moment, so moving across
 * a row does not draw and discard an overlay on every card it passes.
 */
export class WatchedOverlayScheduler {
  private timerId: ReturnType<typeof setTimeout> | null = null;

  public schedule(card: LampaDomElement, torrent: Pick<Torrent, 'files' | 'hash'>): void {
    this.cancel();
    if (card.find('.card-watched').length) return;

    this.timerId = setTimeout(() => {
      this.timerId = null;
      const cardElement = card[0] as HTMLElement | undefined;
      if (!cardElement || !cardElement.classList.contains('focus')) return;
      if (card.find('.card-watched').length) return;
      if (Lampa.Storage.field?.('card_episodes') === false) return;

      // Playback keys progress against the torrent itself, which carries no catalog card.
      const progress = findLatestFileProgress(torrent, torrent as unknown as LampaMovie);
      if (progress) card.find('.card__view').prepend(buildCardWatchedElement(progress));
    }, WATCHED_OVERLAY_DELAY_MS);
  }

  public cancel(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
