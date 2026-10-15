// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { resolveFileIndex } from '../engine/file-parser';
import { TorrPlayEngine } from '../engine/torrplay-engine';
import { Torrent, TorrentFile } from '../types/torrplay';
import { buildFileListItemElement } from './file-list-item';

interface SavedTorrentFileListParams {
  isStale?: () => boolean,
  onBack: () => void,
  onSelect: (fileIndex: number) => void,
  torrent: Torrent,
  videoFiles: TorrentFile[]
}

/**
 * Opens the file list of a torrent saved in the TorrPlay database, laid out like Lampa's own
 * torrent file list: episode stills, names and air dates where TMDB knows the episode, the
 * file size and type, and watched progress. The modal stays open while a file plays, so the
 * player can hand focus back to it.
 */
export async function showSavedTorrentFiles(params: SavedTorrentFileListParams): Promise<void> {
  const { isStale, onBack, onSelect, torrent, videoFiles } = params;
  const torrentFiles = torrent.files || [];
  const movieContext = TorrPlayEngine.resolveMovieContext({
    original_name: torrent.name,
    original_title: torrent.name,
    title: torrent.title || torrent.name,
  });
  const fileInfos = videoFiles.map(file => TorrPlayEngine.resolveFileInfo(file, movieContext, torrent.hash, videoFiles));
  // Playback hashes progress against the torrent itself, whose lack of a catalog card makes
  // Lampa key it by file path, so the file list reads it back the same way.
  const timelineMovie = torrent as unknown as LampaMovie;

  const seasonsData = await TorrPlayEngine.fetchSeasonEpisodes(movieContext, TorrPlayEngine.collectSeasonNumbers(fileInfos));
  if (isStale?.()) return;

  const fallbackImage = TorrPlayEngine.resolvePosterUrl(torrent, movieContext);
  const fileListElement = $('<div class="torrent-files"></div>');

  videoFiles.forEach((file, fallbackIndex) => {
    const resolvedFileIndex = resolveFileIndex(torrentFiles, file);
    const fileIndex = resolvedFileIndex >= 0 ? resolvedFileIndex : fallbackIndex;
    const fullName = file.name || file.path || '';
    const extensionPosition = fullName.lastIndexOf('.');
    const title = Lampa.Utils.clearHtmlTags(
      extensionPosition > 0 ? fullName.slice(0, extensionPosition) : fullName
    );
    const extension = extensionPosition > 0 ? fullName.slice(extensionPosition + 1) : '';
    const formattedSize = file.length > 0 ? Lampa.Utils.bytesToSize(file.length) : '';
    const fileInfo = fileInfos[fallbackIndex];
    const preview = TorrPlayEngine.resolveEpisodePreview(fileInfo, seasonsData, fallbackImage);
    const timeline = Lampa.Timeline
      ? Lampa.Timeline.view(TorrPlayEngine.resolveFileInfo(file, timelineMovie, torrent.hash, videoFiles).hash)
      : undefined;

    const fileItemElement = buildFileListItemElement({
      exe: extension,
      fileInfo,
      preview,
      size: formattedSize,
      timeline,
      title,
    });
    fileItemElement.on('hover:enter', () => onSelect(fileIndex));
    fileListElement.append(fileItemElement);
  });

  Lampa.Modal.open({
    html: fileListElement,
    mask: true,
    onBack,
    size: 'large',
    title: Lampa.Lang?.translate ? Lampa.Lang.translate('title_files') : 'Files',
  });
  // Modal.open updates lazy row visibility after its initial focus attempt.
  Lampa.Controller?.collectionFocus?.(false, fileListElement);
}
