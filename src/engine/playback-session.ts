// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { translate } from '../lang/translations';
import { Torrent, TorrentFile, TorrPlayInstance } from '../types/torrplay';
import { PRELOAD_ENABLED_STORAGE_KEY } from '../ui/settings';
import { closeModalSafely, markTorrentViewed } from './engine-utils';
import { resolveFileInfo, sortTorrentFiles, VIDEO_EXTENSIONS } from './file-parser';
import { resolveMovieContext, resolvePosterUrl } from './media-context';

export async function playSingleVideoFile(
  instance: TorrPlayInstance,
  torrent: Torrent,
  singleFile: TorrentFile,
  movie?: LampaMovie,
  torrentMagnet?: string,
  sourceTorrentItem?: LampaTorrentItem
): Promise<void> {
  const resolvedMovie = resolveMovieContext(movie);
  const poster = resolvePosterUrl(torrent, resolvedMovie);
  const mediaMetadata: LampaMovie = resolvedMovie || {
    card: torrent,
    first_title: torrent.title || torrent.name,
    img: poster || torrent.poster,
    movie: torrent,
    title: torrent.title || torrent.name,
  };

  const resolvedMagnet = torrentMagnet || torrent.magnet;
  const cleanTitle = Lampa.Utils?.clearHtmlTags
    ? Lampa.Utils.clearHtmlTags(singleFile.name || singleFile.path.split('/').pop() || 'Video')
    : (singleFile.name || singleFile.path.split('/').pop() || 'Video');
  const sizeString = Lampa.Utils?.bytesToSize
    ? Lampa.Utils.bytesToSize(singleFile.length)
    : String(singleFile.length);

  const originalFileIndex = singleFile.index !== undefined
    ? singleFile.index
    : (torrent.files || []).findIndex(candidate => candidate.path === singleFile.path);
  const targetFileIndex = originalFileIndex >= 0 ? originalFileIndex : 0;

  const fileInfo = resolveFileInfo(singleFile, mediaMetadata, torrent.hash);
  const singlePlaylistItem = {
    episode: fileInfo.episode,
    file_index: targetFileIndex,
    fname: singleFile.name || singleFile.path,
    id: 0,
    path: singleFile.path,
    season: fileInfo.season,
    size: sizeString,
    title: cleanTitle,
    torrent_hash: torrent.hash,
  };

  await playTorrentFile(
    instance,
    torrent.hash,
    targetFileIndex,
    singlePlaylistItem,
    [singlePlaylistItem],
    mediaMetadata,
    'content',
    resolvedMagnet,
    sourceTorrentItem
  );
}

export function displayFileList(
  instance: TorrPlayInstance,
  torrent: Torrent,
  movie?: LampaMovie,
  torrentMagnet?: string,
  sourceTorrentItem?: LampaTorrentItem
): void {
  const torrentFiles: TorrentFile[] = torrent.files || [];
  const videoFiles = torrentFiles.filter(file => {
    const extension = file.path.split('.').pop()?.toLowerCase() || '';
    return VIDEO_EXTENSIONS.includes(extension);
  });

  if (videoFiles.length === 0) {
    if (Lampa.Noty) {
      Lampa.Noty.show(translate('torrplay_noty_no_video', 'No video files found in torrent'));
    }
    return;
  }

  const sortedVideoFiles = sortTorrentFiles(videoFiles);

  const resolvedMovie = resolveMovieContext(movie);
  const poster = resolvePosterUrl(torrent, resolvedMovie);
  const mediaMetadata: LampaMovie = resolvedMovie || {
    card: torrent,
    first_title: torrent.title || torrent.name,
    img: poster || torrent.poster,
    movie: torrent,
    title: torrent.title || torrent.name,
  };

  const resolvedMagnet = torrentMagnet || torrent.magnet;

  // If single video file, start directly
  if (sortedVideoFiles.length === 1) {
    void playSingleVideoFile(
      instance,
      torrent,
      sortedVideoFiles[0],
      movie,
      resolvedMagnet,
      sourceTorrentItem
    );
    return;
  }

  // Build playlist objects for Lampa
  const playlist = sortedVideoFiles.map((file, playlistIndex) => {
    const cleanTitle = Lampa.Utils.clearHtmlTags(
      file.name || file.path.split('/').pop() || `File ${playlistIndex + 1}`
    );
    const originalFileIndex = file.index !== undefined
      ? file.index
      : torrentFiles.findIndex(candidate => candidate.path === file.path);
    const fileInfo = resolveFileInfo(file, mediaMetadata, torrent.hash, sortedVideoFiles);
    return {
      episode: fileInfo.episode,
      file_index: originalFileIndex >= 0 ? originalFileIndex : playlistIndex,
      fname: cleanTitle,
      id: playlistIndex,
      path: file.path,
      season: fileInfo.season,
      size: Lampa.Utils.bytesToSize(file.length),
      title: cleanTitle,
      torrent_hash: torrent.hash,
    };
  });

  const fileListElement = $('<div class="torrent-files"></div>');

  playlist.forEach((playlistItem, playlistIndex) => {
    const extensionPosition = playlistItem.title.lastIndexOf('.');
    const extension = extensionPosition > 0 ? playlistItem.title.slice(extensionPosition + 1) : '';
    const title = extensionPosition > 0
      ? playlistItem.title.slice(0, extensionPosition)
      : playlistItem.title;
    const fileItemElement = Lampa.Template.get('torrent_file', {
      exe: extension,
      size: playlistItem.size,
      title,
    });
    const fileInfo = resolveFileInfo(playlistItem, mediaMetadata, torrent.hash, playlist);
    const timeline = Lampa.Timeline
      ? Lampa.Timeline.view(fileInfo.hash)
      : undefined;

    if (timeline) fileItemElement.append(Lampa.Timeline.render(timeline));

    fileItemElement.on('hover:enter', async () => {
      const targetFileIndex = playlistItem.file_index !== undefined
        ? playlistItem.file_index
        : playlistIndex;
      if (typeof Lampa !== 'undefined' && Lampa.Modal && typeof Lampa.Modal.close === 'function') {
        Lampa.Modal.close();
      }
      await playTorrentFile(
        instance,
        torrent.hash,
        targetFileIndex,
        playlistItem,
        playlist,
        mediaMetadata,
        'content',
        resolvedMagnet,
        sourceTorrentItem
      );
    });

    fileListElement.append(fileItemElement);
  });

  const returnController = Lampa.Controller?.enabled?.().name || 'content';

  Lampa.Modal.open({
    html: fileListElement,
    mask: true,
    onBack: () => {
      Lampa.Modal.close();
      Lampa.Controller.toggle(returnController);
    },
    size: 'large',
    title: Lampa.Lang?.translate('title_files') || 'Files',
  });
}

export async function playTorrentFile(
  instance: TorrPlayInstance,
  torrentHash: string,
  fileIndex: number,
  playlistItem: LampaPlaylistItem,
  playlist: LampaPlaylistItem[],
  movie?: LampaMovie,
  returnController = 'content',
  magnet?: string,
  sourceTorrentItem?: LampaTorrentItem
): Promise<void> {
  const resolvedMovie = resolveMovieContext(movie);
  const poster = resolvePosterUrl(undefined, resolvedMovie) || playlistItem.img || '';
  const title =
    resolvedMovie?.title ||
    resolvedMovie?.name ||
    playlistItem.title ||
    playlistItem.fname ||
    'Torrent';
  const originalTitle =
    resolvedMovie?.original_title ||
    resolvedMovie?.original_name ||
    title;
  const cardId =
    resolvedMovie?.id ||
    (torrentHash
      ? (typeof Lampa !== 'undefined' && Lampa.Utils?.hash
        ? Lampa.Utils.hash(torrentHash)
        : torrentHash)
      : Date.now());

  const historyCard: LampaMovie = {
    ...resolvedMovie,
    id: cardId,
    img: poster,
    name: title,
    original_name: originalTitle,
    original_title: originalTitle,
    poster,
    release_date: resolvedMovie?.release_date || resolvedMovie?.first_air_date || '',
    source: resolvedMovie?.source || 'torrplay',
    title,
  };

  const shouldPreload = Lampa.Storage.get(PRELOAD_ENABLED_STORAGE_KEY, true);

  if (shouldPreload) {
    const { PreloadModal } = await import('../ui/preload-modal');
    const loadingMedia = {
      card: historyCard,
      first_title: historyCard.name || historyCard.title,
      img: poster,
      movie: historyCard,
      title: playlistItem.title || playlistItem.fname,
    };
    const isPreloadReady = await PreloadModal.waitUntilReady(
      instance,
      torrentHash,
      { index: fileIndex, magnet, path: playlistItem.path },
      loadingMedia
    );
    if (!isPreloadReady) return; // User cancelled preload
  } else {
    if (typeof Lampa !== 'undefined' && Lampa.Loading) {
      Lampa.Loading.stop();
    }
  }

  // Resolve final stream URL with playback token attached
  const streamUrl = await TorrPlayApi.getStreamUrl(instance, torrentHash, {
    index: fileIndex,
    magnet,
    path: playlistItem.path,
  });

  const fileInfo = resolveFileInfo(playlistItem, historyCard, torrentHash, playlist);
  const playerTimeline = Lampa.Timeline
    ? Lampa.Timeline.view(fileInfo.hash)
    : undefined;

  closeModalSafely();

  const mappedPlaylist = playlist.map((candidateItem, candidateIndex) => {
    const targetIndex = candidateItem.file_index !== undefined
      ? candidateItem.file_index
      : candidateIndex;
    const candidateInfo = resolveFileInfo(candidateItem, historyCard, torrentHash, playlist);
    const candidateTimeline = Lampa.Timeline
      ? Lampa.Timeline.view(candidateInfo.hash)
      : undefined;
    const isCurrentFile = targetIndex === fileIndex;

    const mappedItem: LampaPlayerItem = {
      ...candidateItem,
      ad: false,
      card: historyCard,
      episode: candidateInfo.episode,
      first_title: historyCard.name || historyCard.title,
      movie: historyCard,
      no_ad: true,
      season: candidateInfo.season,
      timeline: candidateTimeline,
      torrent_hash: torrentHash,
      url: isCurrentFile
        ? streamUrl
        : (callback?: () => void) => {
          TorrPlayApi.getStreamUrl(instance, torrentHash, {
            index: targetIndex,
            magnet,
            path: candidateItem.path,
          }).then(resolvedUrl => {
            mappedItem.url = resolvedUrl;
            if (typeof callback === 'function') callback();
          }).catch(() => {
            if (typeof callback === 'function') callback();
          });
        },
    };
    return mappedItem;
  });

  const currentPlaylistIndex = mappedPlaylist.findIndex(item => item.file_index === fileIndex);

  let playerItem: LampaPlayerItem;
  if (currentPlaylistIndex >= 0) {
    playerItem = mappedPlaylist[currentPlaylistIndex];
    if (playerTimeline) playerItem.timeline = playerTimeline;
  } else {
    playerItem = {
      ...playlistItem,
      ad: false,
      card: historyCard,
      episode: fileInfo.episode,
      first_title: historyCard.name || historyCard.title,
      movie: historyCard,
      no_ad: true,
      season: fileInfo.season,
      timeline: playerTimeline,
      torrent_hash: torrentHash,
      url: streamUrl,
    };
    if (mappedPlaylist.length === 0) {
      mappedPlaylist.push(playerItem);
    }
  }

  playerItem.continue_play = true;
  playerItem.torrent = true;
  for (const item of mappedPlaylist) {
    item.continue_play = true;
    item.torrent = true;
  }

  if (typeof Lampa !== 'undefined' && Lampa.Favorite && typeof Lampa.Favorite.add === 'function') {
    Lampa.Favorite.add('history', historyCard, 100);
  }

  if (typeof Lampa !== 'undefined' && Lampa.Player && typeof Lampa.Player.playlist === 'function') {
    Lampa.Player.playlist(mappedPlaylist);
  }
  Lampa.Player.play(playerItem);
  markTorrentViewed(sourceTorrentItem);
  Lampa.Player.callback(() => {
    Lampa.Controller.toggle(returnController === 'modal' ? 'content' : returnController);
  });

  if (typeof Lampa !== 'undefined' && Lampa.Listener && typeof Lampa.Listener.send === 'function') {
    Lampa.Listener.send('torrent_file', {
      element: playerItem,
      item: null,
      items: playlist,
      params: {
        files: playlist,
        movie: historyCard,
      },
      type: 'onenter',
    });
  }
}
