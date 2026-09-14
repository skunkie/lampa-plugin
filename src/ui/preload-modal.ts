// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { translate } from '../lang/translations';
import { PreloadResponse, TorrPlayInstance } from '../types/torrplay';

export class PreloadModal {
  /**
   * Calculates preload percentage from PreloadResponse.
   * Handles target_bytes/completed_bytes ratio, decimal 0..1 progress, or percentage 0..100.
   */
  public static calculateProgress(
    preloadResponse: Partial<PreloadResponse>
  ): number {
    const completedBytes = preloadResponse.completed_bytes
      ?? preloadResponse.preloaded_bytes
      ?? 0;
    const targetBytes = preloadResponse.target_bytes
      ?? preloadResponse.preload_size
      ?? 0;

    let progress = 0;
    if (targetBytes > 0) {
      progress = (completedBytes * 100) / targetBytes;
    } else if (preloadResponse.progress !== undefined) {
      progress = preloadResponse.progress <= 1 && preloadResponse.progress > 0
        ? preloadResponse.progress * 100
        : preloadResponse.progress;
    }

    if (isNaN(progress) || progress < 0) {
      return 0;
    }
    return Math.min(100, progress);
  }

  public static async waitUntilReady(
    instance: TorrPlayInstance,
    torrentHash: string,
    fileIdentifier: { index?: number, magnet?: string, path?: string },
    mediaMetadata?: LampaMovie | string
  ): Promise<boolean> {
    const loadingMedia = typeof mediaMetadata === 'object' && mediaMetadata !== null
      ? {
        background: mediaMetadata.background || mediaMetadata.img || '',
        card: mediaMetadata.card || mediaMetadata.movie,
        first_title: mediaMetadata.first_title || mediaMetadata.name || mediaMetadata.title,
        img: mediaMetadata.img || mediaMetadata.poster_path,
        movie: mediaMetadata.movie || mediaMetadata.card,
        title: mediaMetadata.title || mediaMetadata.first_title || 'TorrPlay',
      }
      : {
        title: typeof mediaMetadata === 'string' ? mediaMetadata : 'TorrPlay',
      };

    return new Promise<boolean>(resolve => {
      let isStopped = false;
      let lastCompletedBytes = 0;
      let lastProgressAtMs = Date.now();
      let pollingTimeout: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          pollingTimeout = null;
        }
        if (typeof Lampa !== 'undefined' && Lampa.Loading) {
          Lampa.Loading.stop();
        }
      };

      const handleCancel = () => {
        if (isStopped) return;
        isStopped = true;
        cleanup();
        TorrPlayApi.cancelPreload(instance, torrentHash).catch(() => {});
        resolve(false);
      };

      // Start Lampa.Loading if available
      if (typeof Lampa !== 'undefined' && Lampa.Loading) {
        Lampa.Loading.start(handleCancel, '', {
          media: loadingMedia,
        });
      }

      const processPreloadResponse = (preloadResponse: PreloadResponse): boolean => {
        const progress = PreloadModal.calculateProgress(preloadResponse);

        if (preloadResponse.status === 'ready' || progress >= 95) {
          cleanup();
          resolve(true);
          return true;
        }

        const completedBytes = preloadResponse.completed_bytes
          ?? preloadResponse.preloaded_bytes
          ?? 0;
        if (completedBytes > lastCompletedBytes) {
          lastCompletedBytes = completedBytes;
          lastProgressAtMs = Date.now();
        }

        const downloadRateBytesPerSecond = preloadResponse.download_rate ?? 0;
        const formattedSpeed = downloadRateBytesPerSecond > 0 && typeof Lampa !== 'undefined' && Lampa.Utils
          ? Lampa.Utils.bytesToSize(downloadRateBytesPerSecond * 8, true)
          : '0.0';

        const connectedSeeders = parseInt(String(preloadResponse.connected_seeders ?? 0), 10);
        const activePeerCount = preloadResponse.active_peers ?? 0;
        const totalPeerCount = preloadResponse.total_peers ?? 0;

        const activePeers = parseInt(String(activePeerCount || connectedSeeders || 0), 10);
        const totalPeers = parseInt(String(totalPeerCount || activePeers || 0), 10);
        const leechers = Math.max(0, activePeers - connectedSeeders);

        if (typeof Lampa !== 'undefined' && Lampa.Loading) {
          Lampa.Loading.setProgress(progress, {
            active_peers: activePeers,
            connected_seeders: connectedSeeders,
            download_speed: downloadRateBytesPerSecond,
            leechers,
            seeders: connectedSeeders,
            speed: formattedSpeed,
            total_peers: totalPeers,
          });
        }

        return false;
      };

      const next = () => {
        if (isStopped) return;

        if (Date.now() - lastProgressAtMs > 30000) {
          if (typeof Lampa !== 'undefined' && Lampa.Noty) {
            Lampa.Noty.show(translate('torrplay_noty_preload_timeout', 'Preload timed out'));
          }
          handleCancel();
          return;
        }

        pollingTimeout = setTimeout(update, 1000);
      };

      const update = async () => {
        if (isStopped) return;

        try {
          const preloadResponse = await TorrPlayApi.getPreload(instance, torrentHash);
          if (isStopped) return;

          const isReady = processPreloadResponse(preloadResponse);
          if (!isReady) {
            next();
          }
        } catch {
          next();
        }
      };

      // Initiate preload on the instance
      TorrPlayApi.startPreload(instance, torrentHash, {
        file_index: fileIdentifier.index,
        file_path: fileIdentifier.path,
        magnet: fileIdentifier.magnet,
      }).then(initialPreloadResponse => {
        if (isStopped) return;
        if (initialPreloadResponse) {
          const isReady = processPreloadResponse(initialPreloadResponse);
          if (isReady) return;
        }
        next();
      }).catch(() => {
        if (!isStopped) {
          next();
        }
      });
    });
  }
}
