// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { extractHashFromMagnet, normalizeInfoHash, TorrPlayApi } from '../api/torrplay';
import { InstanceManager } from '../instances/instance-manager';
import { translate } from '../lang/translations';
import {
  ParsedFileInfo,
  Torrent,
  TorrentFile,
  TorrPlayInstance,
} from '../types/torrplay';
import { PlayDialog } from '../ui/play-dialog';
import {
  PLAYBACK_MODE_STORAGE_KEY,
  TORRPLAY_ENABLED_STORAGE_KEY,
} from '../ui/settings';
import { closeModalSafely } from './engine-utils';
import { collectSeasonNumbers, EpisodePreview, fetchSeasonEpisodes, resolveEpisodePreview } from './episode-preview';
import {
  resolveFileIndex,
  resolveFileInfo,
  sortTorrentFiles,
  VIDEO_EXTENSIONS,
} from './file-parser';
import { resolveMovieContext, resolvePosterUrl } from './media-context';
import { displayFileList, playSingleVideoFile, playTorrentFile } from './playback-session';
import { SavedTorrents } from './saved-torrents';

export class TorrPlayEngine {
  private static originalTorrentOpen: ((hash: string, movie?: LampaMovie) => void) | null = null;
  private static originalTorrentStart: ((torrentItem: LampaTorrentItem, movie?: LampaMovie) => void) | null = null;

  public static sortTorrentFiles<T extends { name?: string, path?: string }>(files: T[]): T[] {
    return sortTorrentFiles(files);
  }

  public static collectSeasonNumbers(fileInfos: ParsedFileInfo[]): number[] {
    return collectSeasonNumbers(fileInfos);
  }

  public static fetchSeasonEpisodes(
    movie: LampaMovie | undefined,
    seasonNumbers: number[]
  ): Promise<Record<string, LampaApiSeasonData>> {
    return fetchSeasonEpisodes(movie, seasonNumbers);
  }

  public static resolveEpisodePreview(
    fileInfo: ParsedFileInfo,
    seasonsData: Record<string, LampaApiSeasonData>,
    fallbackImage?: string
  ): EpisodePreview | undefined {
    return resolveEpisodePreview(fileInfo, seasonsData, fallbackImage);
  }

  public static isEnabled(): boolean {
    if (typeof Lampa === 'undefined' || !Lampa.Storage) return true;
    return Lampa.Storage.get(TORRPLAY_ENABLED_STORAGE_KEY, true);
  }

  public static getPlaybackMode(): 'ask' | 'torrplay' | 'context' {
    if (typeof Lampa === 'undefined' || !Lampa.Storage) return 'torrplay';
    return Lampa.Storage.get(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
  }

  public static init(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Torrent) return;

    // Save reference to original Lampa.Torrent.start
    if (!this.originalTorrentStart && typeof Lampa.Torrent.start === 'function') {
      this.originalTorrentStart = Lampa.Torrent.start.bind(Lampa.Torrent);
    }

    // Replace Lampa.Torrent.start with a clean, minimal forwarder to TorrPlayEngine.startPlayback
    Lampa.Torrent.start = (torrentItem: LampaTorrentItem, movie?: LampaMovie) => {
      if (!this.isEnabled()) {
        if (this.originalTorrentStart) {
          this.originalTorrentStart(torrentItem, movie);
        }
        return;
      }

      const isTorrPlaySession =
        movie?.torrplay ||
        torrentItem?.torrplay ||
        (typeof Lampa !== 'undefined' && Lampa.Activity?.active?.()?.torrplay);

      const mode = isTorrPlaySession ? 'torrplay' : this.getPlaybackMode();

      if (mode === 'context') {
        // Manual mode: let default player handle standard click
        if (this.originalTorrentStart) {
          this.originalTorrentStart(torrentItem, movie);
        }
        return;
      }

      if (mode === 'ask') {
        this.promptPlayerChoice(torrentItem, movie);
        return;
      }

      // mode === 'torrplay'
      this.startPlayback(torrentItem, movie).catch((err: unknown) => {
        console.error('[TorrPlay] Playback failed:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (typeof Lampa !== 'undefined') {
          closeModalSafely();
          if (Lampa.Loading) Lampa.Loading.stop();
          if (Lampa.Noty) {
            Lampa.Noty.show(
              translate('torrplay_noty_error', `TorrPlay: ${errorMessage}`, { msg: errorMessage })
            );
          }
        }
      });
    };

    // Save reference to original Lampa.Torrent.open if present
    if (!this.originalTorrentOpen && typeof Lampa.Torrent.open === 'function') {
      this.originalTorrentOpen = Lampa.Torrent.open.bind(Lampa.Torrent);
    }

    if (typeof Lampa.Torrent.open === 'function') {
      Lampa.Torrent.open = (hash: string, movie?: LampaMovie) => {
        if (!this.isEnabled()) {
          if (this.originalTorrentOpen) {
            this.originalTorrentOpen(hash, movie);
          }
          return;
        }

        const isTorrPlaySession =
          movie?.torrplay ||
          (typeof Lampa !== 'undefined' && Lampa.Activity?.active?.()?.torrplay);

        const mode = isTorrPlaySession ? 'torrplay' : this.getPlaybackMode();

        if (mode === 'context') {
          if (this.originalTorrentOpen) {
            this.originalTorrentOpen(hash, movie);
          }
          return;
        }

        if (mode === 'ask') {
          this.promptPlayerChoice({ hash }, movie);
          return;
        }

        // mode === 'torrplay'
        this.startPlayback({ hash }, movie).catch((err: unknown) => {
          console.error('[TorrPlay] Playback failed:', err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (typeof Lampa !== 'undefined') {
            closeModalSafely();
            if (Lampa.Loading) Lampa.Loading.stop();
            if (Lampa.Noty) {
              Lampa.Noty.show(
                translate('torrplay_noty_error', `TorrPlay: ${errorMessage}`, { msg: errorMessage })
              );
            }
          }
        });
      };
    }
  }

  /**
   * Prompts user to choose between TorrPlay and Default player (TorrServer).
   */
  public static promptPlayerChoice(torrentItem: LampaTorrentItem, movie?: LampaMovie): void {
    const title = torrentItem.title || torrentItem.Title || (movie && (movie.title || movie.name)) || 'Torrent';
    // Captured before the dialog opens, while the caller's controller is still active.
    const returnController = Lampa.Controller?.enabled?.().name || 'content';

    Lampa.Select.show({
      items: [
        {
          action: 'torrplay',
          subtitle: translate('torrplay_play_via_descr', 'Stream via active TorrPlay instance'),
          title: 'TorrPlay',
        },
        {
          action: 'default',
          subtitle: translate('torrplay_choice_torrserver_descr', 'Stream via standard Lampa torrent player'),
          title: translate('torrplay_choice_torrserver', 'TorrServer / Default'),
        },
      ],
      onBack: () => {
        if (Lampa.Controller) Lampa.Controller.toggle(returnController);
      },
      onSelect: (selectedPlayer: LampaSelectItem) => {
        if (selectedPlayer.action === 'torrplay') {
          this.playTorrentDirect(torrentItem, movie, returnController);
        } else {
          if (this.originalTorrentStart) {
            this.originalTorrentStart(torrentItem, movie);
          }
        }
      },
      title: translate('torrplay_play_title', `Play: ${title}`, { title }),
    });
  }

  /**
   * Directly starts torrent playback via TorrPlay.
   */
  public static playTorrentDirect(
    torrentItem: LampaTorrentItem,
    movie?: LampaMovie,
    returnController?: string
  ): void {
    // Callers that start playback from a menu pass the controller that was active before it
    // opened, since by now the menu's own controller is the enabled one.
    const resolvedReturnController = returnController || Lampa.Controller?.enabled?.().name || 'content';

    this.startPlayback(torrentItem, movie, resolvedReturnController).catch((err: unknown) => {
      console.error('[TorrPlay] Playback failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (typeof Lampa !== 'undefined') {
        closeModalSafely();
        if (Lampa.Loading) Lampa.Loading.stop();
        if (Lampa.Controller) Lampa.Controller.toggle(resolvedReturnController);
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_error', `TorrPlay: ${errorMessage}`, { msg: errorMessage })
          );
        }
      }
    });
  }

  /**
   * Extracts movie data from explicit context or currently active Lampa activity.
   */
  public static resolveMovieContext(movieContext?: unknown): LampaMovie | undefined {
    return resolveMovieContext(movieContext);
  }

  /**
   * Resolves an absolute, downloadable poster URL for TorrPlay database and preload screens.
   */
  public static resolvePosterUrl(torrentItem?: { img?: string, poster?: string }, movieContext?: unknown): string {
    return resolvePosterUrl(torrentItem, movieContext);
  }

  /**
   * Resolves file metadata (season, episode, serial flag) and standard Lampa timeline hash.
   * Matches Lampa's native EpisodeParser and Torserver.parse behavior to align timecodes
   * with Lampa's movie and TV show cards, watch history, and in-player playlist resumes.
   */
  public static resolveFileInfo(
    file: { name?: string, path?: string },
    movie?: LampaMovie,
    torrentHash?: string,
    playlist?: LampaPlaylistItem[]
  ): ParsedFileInfo {
    return resolveFileInfo(file, movie, torrentHash, playlist);
  }

  /**
   * Adds torrent to TorrPlay database without immediately starting playback.
   */
  public static async saveToDatabase(torrentItem: LampaTorrentItem, movie?: LampaMovie): Promise<void> {
    const rawSource = (
      torrentItem?.MagnetUri ||
      torrentItem?.Link ||
      torrentItem?.link ||
      torrentItem?.url ||
      ''
    ).trim();

    const isMagnet = rawSource.toLowerCase().startsWith('magnet:');
    const magnetUri = isMagnet ? rawSource : undefined;
    const torrentLink = !isMagnet && /^https?:\/\//i.test(rawSource) ? rawSource : undefined;
    const magnetHash = isMagnet ? extractHashFromMagnet(rawSource) : null;
    const torrentHash =
      normalizeInfoHash(torrentItem?.info_hash) ||
      normalizeInfoHash(torrentItem?.InfoHash) ||
      magnetHash ||
      normalizeInfoHash(torrentItem?.hash) ||
      normalizeInfoHash(torrentItem?.Hash) ||
      undefined;

    const resolvedMovie = resolveMovieContext(movie);
    const title =
      torrentItem?.title ||
      torrentItem?.Title ||
      resolvedMovie?.title ||
      resolvedMovie?.name ||
      'Torrent';
    const poster = resolvePosterUrl(torrentItem, resolvedMovie);

    if (!torrentHash && !magnetUri && !torrentLink) {
      if (Lampa.Noty) {
        Lampa.Noty.show(
          translate('torrplay_noty_hash_required', 'TorrPlay: Valid magnet link or info hash is required')
        );
      }
      return;
    }

    try {
      const instance = await InstanceManager.getBestInstance();
      const outcome = await this.withFailover(instance, async i => {
        const resolved = torrentLink
          ? await TorrPlayApi.resolveTorrent(i, torrentLink)
          : undefined;
        return TorrPlayApi.addTorrent(i, {
          hash: torrentHash,
          magnet: resolved?.magnet || magnetUri,
          poster,
          title,
        });
      });
      SavedTorrents.markSaved(torrentHash || outcome.result?.hash, outcome.instance.id);
      if (Lampa.Noty) {
        Lampa.Noty.show(
          translate('torrplay_noty_added_db', `TorrPlay: "${title}" added to database!`, { title })
        );
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (Lampa.Noty) {
        Lampa.Noty.show(
          translate('torrplay_noty_save_error', `TorrPlay Save Error: ${errorMessage}`, { msg: errorMessage })
        );
      }
    }
  }

  public static async startPlayback(
    torrentItem: LampaTorrentItem,
    movie?: LampaMovie,
    returnController?: string
  ): Promise<void> {
    // Callers that start playback from a menu pass the controller that was active before it
    // opened; capture the rest here, before the options dialog can take the controller over.
    const resolvedReturnController = returnController || Lampa.Controller?.enabled?.().name || 'content';
    const rawSource = (
      torrentItem?.MagnetUri ||
      torrentItem?.Link ||
      torrentItem?.link ||
      torrentItem?.url ||
      ''
    ).trim();

    const isMagnet = rawSource.toLowerCase().startsWith('magnet:');
    const magnetUri = isMagnet ? rawSource : undefined;
    const torrentLink = !isMagnet && /^https?:\/\//i.test(rawSource) ? rawSource : undefined;
    const magnetHash = isMagnet ? extractHashFromMagnet(rawSource) : null;
    const torrentHash =
      normalizeInfoHash(torrentItem?.info_hash) ||
      normalizeInfoHash(torrentItem?.InfoHash) ||
      magnetHash ||
      normalizeInfoHash(torrentItem?.hash) ||
      normalizeInfoHash(torrentItem?.Hash) ||
      undefined;

    const resolvedMovie = resolveMovieContext(movie);
    const title =
      torrentItem?.title ||
      torrentItem?.Title ||
      resolvedMovie?.title ||
      resolvedMovie?.name ||
      'Torrent';
    const poster = resolvePosterUrl(torrentItem, resolvedMovie);

    // 1. Resolve storage and DB persistence preferences
    const playOptions = await PlayDialog.resolveOptions(title);
    if (!playOptions) return; // User canceled dialog

    const hasPersistableSource = Boolean(torrentHash || magnetUri || torrentLink);
    const hasTemporarySource = Boolean(torrentHash || torrentLink);
    if (
      (playOptions.saveToDb && !hasPersistableSource)
      || (!playOptions.saveToDb && !hasTemporarySource)
    ) {
      Lampa.Controller.toggle(resolvedReturnController);
      if (Lampa.Noty) {
        Lampa.Noty.show(
          translate('torrplay_noty_hash_required', 'TorrPlay: Valid magnet link or info hash is required')
        );
      }
      return;
    }

    // 2. Resolve best TorrPlay instance
    let instance = await InstanceManager.getBestInstance();
    let isCanceled = false;

    // 3. Show native media loading screen instead of modal
    const loadingMedia = {
      card: resolvedMovie,
      first_title: resolvedMovie?.name || resolvedMovie?.title || title,
      img: poster,
      movie: resolvedMovie,
      title,
    };

    if (typeof Lampa !== 'undefined' && Lampa.Loading) {
      Lampa.Loading.start(
        () => {
          isCanceled = true;
          Lampa.Loading.stop();
          Lampa.Controller.toggle(resolvedReturnController);
        },
        '',
        { media: loadingMedia }
      );
    }

    let torrent: Torrent;

    try {
      const outcome = await this.withFailover(
        instance,
        async i => {
          const resolved = torrentLink
            ? await TorrPlayApi.resolveTorrent(i, torrentLink)
            : undefined;
          if (isCanceled) throw new Error('Playback canceled');
          if (playOptions.saveToDb) {
            return TorrPlayApi.addTorrent(i, {
              hash: torrentHash,
              magnet: resolved?.magnet || magnetUri,
              poster,
              storage: playOptions.storage,
              title,
            });
          }
          return resolved || TorrPlayApi.getTorrent(i, torrentHash as string, magnetUri);
        },
        () => isCanceled
      );
      instance = outcome.instance;
      torrent = outcome.result;
      if (isCanceled) return;
      if (playOptions.saveToDb) {
        SavedTorrents.markSaved(torrentHash || torrent.hash, outcome.instance.id);
      }
    } catch (err: unknown) {
      if (isCanceled) return;
      if (typeof Lampa !== 'undefined' && Lampa.Loading) {
        Lampa.Loading.stop();
      }
      throw err;
    }

    if (isCanceled) return;

    // 4. Poll metadata until files list is ready if needed
    const readyTorrent = torrent.files && torrent.files.length > 0
      ? torrent
      : await this.waitForFiles(instance, torrent.hash);
    if (isCanceled) return;

    const torrentFiles: TorrentFile[] = readyTorrent.files || [];
    const videoFiles = torrentFiles.filter(file => {
      const extension = file.path.split('.').pop()?.toLowerCase() || '';
      return VIDEO_EXTENSIONS.includes(extension);
    });

    if (videoFiles.length === 0) {
      if (typeof Lampa !== 'undefined' && Lampa.Loading) {
        Lampa.Loading.stop();
      }
      Lampa.Controller.toggle(resolvedReturnController);
      if (Lampa.Noty) {
        Lampa.Noty.show(translate('torrplay_noty_no_video', 'No video files found in torrent'));
      }
      return;
    }

    const sortedVideoFiles = this.sortTorrentFiles(videoFiles);

    // 5. If single video file, launch preload and playback directly without opening any modal
    if (sortedVideoFiles.length === 1) {
      if (typeof Lampa !== 'undefined' && Lampa.Loading) {
        Lampa.Loading.stop();
      }
      await playSingleVideoFile(
        instance,
        readyTorrent,
        sortedVideoFiles[0],
        movie,
        magnetUri,
        torrentItem,
        resolvedReturnController
      );
      return;
    }

    // Multi-file torrent: dismiss loading screen and open file choice modal
    if (typeof Lampa !== 'undefined' && Lampa.Loading) {
      Lampa.Loading.stop();
    }
    await displayFileList(instance, readyTorrent, movie, magnetUri, torrentItem, resolvedReturnController);
  }

  /**
   * Starts playback directly from an existing torrent object and file index.
   */
  public static async startTorrentPlayback(
    torrent: Torrent,
    fileIndex = 0,
    movie?: LampaMovie,
    sourceInstance?: TorrPlayInstance,
    returnController = 'content'
  ): Promise<void> {
    const instance = sourceInstance || await InstanceManager.getBestInstance();
    const readyTorrent = torrent.files && torrent.files.length > 0
      ? torrent
      : await this.waitForFiles(instance, torrent.hash);

    const torrentFiles: TorrentFile[] = readyTorrent.files || [];
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

    const resolvedMovie = movie ? resolveMovieContext(movie) : undefined;
    const poster = resolvePosterUrl(readyTorrent, resolvedMovie);
    const mediaMetadata: LampaMovie = resolvedMovie || {
      card: readyTorrent,
      first_title: readyTorrent.title || readyTorrent.name,
      img: poster || readyTorrent.poster,
      movie: readyTorrent,
      title: readyTorrent.title || readyTorrent.name,
    };

    const sortedFiles = this.sortTorrentFiles(videoFiles);

    const playlist = sortedFiles.map((file, playlistIndex) => {
      const cleanTitle = Lampa.Utils.clearHtmlTags(
        file.name || file.path.split('/').pop() || `File ${playlistIndex + 1}`
      );
      const originalFileIndex = resolveFileIndex(torrentFiles, file);
      const fileInfo = resolveFileInfo(file, mediaMetadata, readyTorrent.hash, sortedFiles);
      return {
        episode: fileInfo.episode,
        file_index: originalFileIndex >= 0 ? originalFileIndex : playlistIndex,
        fname: cleanTitle,
        id: playlistIndex,
        path: file.path,
        season: fileInfo.season,
        size: Lampa.Utils.bytesToSize(file.length),
        title: cleanTitle,
        torrent_hash: readyTorrent.hash,
      };
    });

    const selectedPlaylistItem =
      playlist.find(item => item.file_index === fileIndex) ||
      playlist[0];
    const targetFileIndex = selectedPlaylistItem.file_index !== undefined
      ? selectedPlaylistItem.file_index
      : fileIndex;

    await playTorrentFile(
      instance,
      readyTorrent.hash,
      targetFileIndex,
      selectedPlaylistItem,
      playlist,
      mediaMetadata,
      returnController,
      readyTorrent.magnet
    );
  }

  /**
   * Runs `action` against `instance`; on failure, fails over to the next reachable
   * instance and retries `action` once against it. Rethrows the original error when
   * `isAborted` reports the caller no longer needs a result, or when no fallback is
   * reachable.
   */
  private static async withFailover<T>(
    instance: TorrPlayInstance,
    action: (instance: TorrPlayInstance) => Promise<T>,
    isAborted?: () => boolean
  ): Promise<{ instance: TorrPlayInstance, result: T }> {
    try {
      return { instance, result: await action(instance) };
    } catch (error) {
      if (isAborted?.()) throw error;
      const fallback = await InstanceManager.failover(instance);
      if (!fallback) throw error;
      return { instance: fallback, result: await action(fallback) };
    }
  }

  private static async waitForFiles(
    instance: TorrPlayInstance,
    torrentHash: string,
    maximumAttempts = 30
  ): Promise<Torrent> {
    for (let attemptIndex = 0; attemptIndex < maximumAttempts; attemptIndex++) {
      try {
        const torrentMetadata = await TorrPlayApi.getTorrent(instance, torrentHash);
        if (torrentMetadata && torrentMetadata.files && torrentMetadata.files.length > 0) {
          return torrentMetadata;
        }
      } catch {} // Transient API error during metadata polling — retry on next iteration.
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for torrent metadata');
  }

  public static resetForTesting(): void {
    if (this.originalTorrentOpen && typeof Lampa !== 'undefined' && Lampa.Torrent) {
      Lampa.Torrent.open = this.originalTorrentOpen;
    }
    this.originalTorrentOpen = null;
    if (this.originalTorrentStart && typeof Lampa !== 'undefined' && Lampa.Torrent) {
      Lampa.Torrent.start = this.originalTorrentStart;
    }
    this.originalTorrentStart = null;
  }
}
