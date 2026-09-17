// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { EpisodePreview } from '../engine/episode-preview';
import { ParsedFileInfo } from '../types/torrplay';

interface FileListItemParams {
  exe: string,
  fileInfo: ParsedFileInfo,
  preview?: EpisodePreview,
  size: string,
  timeline?: unknown,
  title: string
}

/**
 * Builds a file list row using the same native templates and lazy-image
 * wiring as Lampa's own torrent file list (src/interaction/torrent.js
 * `list()`): `torrent_file_serial` (with a still image, episode name, and air
 * date) when episode metadata is available, otherwise the plain `torrent_file`
 * row. The still image loads through Lampa's own Layer visibility system,
 * which fires 'visible' on elements marked `visibility = 'hidden'`.
 */
export function buildFileListItemElement(params: FileListItemParams): LampaDomElement {
  const { exe, fileInfo, preview, size, timeline, title } = params;

  if (preview) {
    const element = Lampa.Template.get('torrent_file_serial', {
      air_date: preview.airDate,
      episode: fileInfo.episode,
      exe,
      fname: preview.title || title,
      img: preview.img,
      season: fileInfo.season,
      size,
    });

    (element[0] as unknown as { visibility: string }).visibility = 'hidden';
    element.on('visible', () => {
      const image = element.find('img');
      const imageNode = image[0] as unknown as HTMLImageElement;
      if (imageNode?.style) imageNode.style.objectFit = 'cover';
      imageNode.onload = () => { image.addClass('loaded'); };
      imageNode.src = image.attr('data-src');
    });

    if (timeline) element.find('.torrent-serial__content').append(Lampa.Timeline.render(timeline));

    return element;
  }

  const element = Lampa.Template.get('torrent_file', { exe, size, title });
  if (timeline) element.append(Lampa.Timeline.render(timeline));
  return element;
}
