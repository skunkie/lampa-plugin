// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { VIDEO_EXTENSIONS } from '../engine/file-parser';
import { TorrPlayEngine } from '../engine/torrplay-engine';
import { ParsedFileInfo, Torrent, TorrentFile } from '../types/torrplay';

interface TimelineView {
  duration?: number,
  hash: number | string,
  percent?: number,
  time?: number,
  updated?: number
}

export interface FileProgress {
  fileInfo: ParsedFileInfo,
  view: TimelineView
}

function isVideoFile(file: TorrentFile): boolean {
  const extension = (file.name || file.path || '').split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.includes(extension);
}

/**
 * Returns the most recently watched video file of a torrent, hashed exactly as
 * playback records it, or undefined when none of its files has progress.
 */
export function findLatestFileProgress(torrent: Torrent, movie: LampaMovie): FileProgress | undefined {
  if (!Lampa.Timeline) return undefined;

  const sortedFiles = TorrPlayEngine.sortTorrentFiles((torrent.files || []).filter(isVideoFile));
  let latest: FileProgress | undefined;

  sortedFiles.forEach(file => {
    const fileInfo = TorrPlayEngine.resolveFileInfo(file, movie, torrent.hash, sortedFiles);
    const view: TimelineView | undefined = Lampa.Timeline.view(fileInfo.hash);
    if (!view || !view.percent) return;
    if (!latest || (view.updated || 0) >= (latest.view.updated || 0)) latest = { fileInfo, view };
  });

  return latest;
}

/**
 * Builds the overlay Lampa's own catalog cards show on focus: the last watched
 * episode, or how far into a movie the viewer got, above a progress bar.
 */
export function buildCardWatchedElement(progress: FileProgress): LampaDomElement {
  const { fileInfo, view } = progress;
  const label = fileInfo.serial && fileInfo.episode
    ? `${Lampa.Lang?.translate('full_episode') || 'Episode'} ${fileInfo.episode}`
    : `${Lampa.Lang?.translate('title_viewed') || 'Viewed'} ${
      view.time ? Lampa.Utils.secondsToTimeHuman(view.time) : `${view.percent}%`
    }`;

  const wrap = Lampa.Template.get('card_watched', {});
  const item = $('<div class="card-watched__item"></div>');
  item.append($('<span></span>').text(label));
  item.append(Lampa.Timeline.render(view));
  wrap.find('.card-watched__body').append(item);
  return wrap;
}
