// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { translate } from '../lang/translations';
import { PreloadResponse, TorrPlayInstance } from '../types/torrplay';

// A cold torrent reports no progress for a while before its first bytes land: the instance
// waits for metadata before preloading starts at all, and peer discovery follows. Until data
// has actually arrived there is nothing to call stalled, so the opening wait gets its own,
// wider budget and the tighter stall window applies only once bytes have started flowing.
const COLD_START_TIMEOUT_MS = 120000;
const STALL_TIMEOUT_MS = 30000;

export class PreloadModal {
  /**
   * Calculates preload percentage from PreloadResponse.
   * Uses the completed_bytes/target_bytes ratio, or the 0..1 progress fraction when no target is known.
   */
  public static calculateProgress(
    preloadResponse: Partial<PreloadResponse>
  ): number {
    const completedBytes = preloadResponse.completed_bytes ?? 0;
    const targetBytes = preloadResponse.target_bytes ?? 0;

    let progress = 0;
    if (targetBytes > 0) {
      progress = (completedBytes * 100) / targetBytes;
    } else if (preloadResponse.progress !== undefined) {
      progress = preloadResponse.progress * 100;
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
    mediaMetadata?: LampaMovie | string,
    playbackPositionSeconds?: number
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
      let lastProgress = 0;
      let lastProgressAtMs = Date.now();
      let lastPeerCount = 0;
      let hasTransferStarted = false;
      let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
      let pendingStart: Promise<unknown> | null = null;

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
        const cancelPreload = () => {
          TorrPlayApi.cancelPreload(instance, torrentHash).catch(() => {});
        };
        // A start still in flight can reach the instance after the cancel and leave a preload
        // nobody waits for, so the cancel follows it. A failed start may still have reached the
        // instance, so the cancel is sent either way.
        if (pendingStart) {
          pendingStart.then(cancelPreload, cancelPreload);
        } else {
          cancelPreload();
        }
        resolve(false);
      };

      // Start Lampa.Loading if available
      if (typeof Lampa !== 'undefined' && Lampa.Loading) {
        Lampa.Loading.start(handleCancel, '', {
          media: loadingMedia,
        });
      }

      // Returns true once the preload has settled, either ready or given up by the instance.
      const processPreloadResponse = (preloadResponse: PreloadResponse): boolean => {
        // The instance never resumes a failed or evicted preload, and both still report the
        // progress they had made, so this must win over the progress threshold below.
        if (preloadResponse.status === 'failed' || preloadResponse.status === 'evicted') {
          isStopped = true;
          cleanup();
          if (typeof Lampa !== 'undefined' && Lampa.Noty) {
            Lampa.Noty.show(preloadResponse.status === 'failed'
              ? translate(
                'torrplay_noty_preload_failed',
                'Preload failed: not enough memory or the torrent stopped receiving data'
              )
              : translate('torrplay_noty_preload_evicted', 'Preload was stopped to free memory'));
          }
          resolve(false);
          return true;
        }

        const progress = PreloadModal.calculateProgress(preloadResponse);

        if (preloadResponse.status === 'ready' || progress >= 95) {
          cleanup();
          resolve(true);
          return true;
        }

        const completedBytes = preloadResponse.completed_bytes ?? 0;
        if (completedBytes > lastCompletedBytes || progress > lastProgress) {
          lastCompletedBytes = completedBytes;
          lastProgress = progress;
          lastProgressAtMs = Date.now();
          hasTransferStarted = true;
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

        // Peers still arriving is the only sign of life a torrent has before its first bytes,
        // so it counts as forward movement during the opening wait.
        if (!hasTransferStarted && activePeers > lastPeerCount) {
          lastProgressAtMs = Date.now();
        }
        lastPeerCount = Math.max(lastPeerCount, activePeers);

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

      const next = (action: () => void) => {
        if (isStopped) return;

        const idleTimeoutMs = hasTransferStarted ? STALL_TIMEOUT_MS : COLD_START_TIMEOUT_MS;
        if (Date.now() - lastProgressAtMs > idleTimeoutMs) {
          if (typeof Lampa !== 'undefined' && Lampa.Noty) {
            Lampa.Noty.show(translate('torrplay_noty_preload_timeout', 'Preload timed out'));
          }
          handleCancel();
          return;
        }

        pollingTimeout = setTimeout(action, 1000);
      };

      const update = async () => {
        if (isStopped) return;

        try {
          const preloadResponse = await TorrPlayApi.getPreload(instance, torrentHash);
          if (isStopped) return;

          const isSettled = processPreloadResponse(preloadResponse);
          if (!isSettled) {
            next(update);
          }
        } catch {
          next(update);
        }
      };

      // The status endpoint reports whatever preload the instance holds for the torrent, which
      // until a start succeeds may be an earlier attempt's. A failed start is therefore retried
      // rather than polled: the instance answers a repeated identical start with the preload
      // it already runs, so this also recovers a start whose response was lost.
      const start = () => {
        const startRequest = TorrPlayApi.startPreload(instance, torrentHash, {
          file_index: fileIdentifier.index,
          file_path: fileIdentifier.path,
          magnet: fileIdentifier.magnet,
          playback_position_seconds: playbackPositionSeconds,
        });
        pendingStart = startRequest;
        startRequest.then(initialPreloadResponse => {
          pendingStart = null;
          if (isStopped) return;
          // The metadata wait is spent inside this call, so the opening budget only starts
          // counting once it succeeds — otherwise the wait would eat the budget meant to cover
          // peer discovery, which is what the opening window is actually for.
          lastProgressAtMs = Date.now();
          if (initialPreloadResponse) {
            const isSettled = processPreloadResponse(initialPreloadResponse);
            if (isSettled) return;
          }
          next(update);
        }).catch(() => {
          pendingStart = null;
          if (!isStopped) {
            // A rejection here includes the instance itself giving up on the metadata wait, so
            // the budget deliberately keeps the elapsed time rather than starting over.
            next(start);
          }
        });
      };

      start();
    });
  }
}
