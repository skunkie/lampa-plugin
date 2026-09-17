// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { TorrentFile, TorrentStats, TorrPlayInstance } from '../types/torrplay';
import { fetchSeasonEpisodes } from './episode-preview';

/**
 * External players on several platforms never report where playback stopped. The instance
 * keeps a stream's reader open at the position its player last read for a while after the
 * player lets go, so once the viewer is back in Lampa that position is read from the
 * instance's live statistics and saved into Lampa's own timeline. It is only a fallback:
 * whenever the platform reports an exact position for the playlist, that one is kept.
 */

export interface ExternalPlaybackFile {
  episode?: number | null,
  hash: number | string,
  path: string,
  season?: number | null
}

interface ExternalPlaybackCandidate {
  files: ExternalPlaybackFile[],
  hasExactReport: boolean,
  hasSeenActive: boolean,
  instance: TorrPlayInstance,
  isAway: boolean,
  isMeasurementPending: boolean,
  launchedAtMs: number | null,
  movie?: LampaMovie,
  torrentHash: string
}

export interface PlaybackFractionEstimate {
  fraction: number,
  path: string
}

interface TimelineView {
  duration?: number,
  hash: number | string,
  percent?: number,
  time?: number
}

const MINIMUM_PIECE_LENGTH_BYTES = 16384;

/**
 * Length of the torrent's pieces. Listed piece sizes can omit every full piece when the
 * instance tracks only a few, so a size is trusted only when it accounts for the torrent's
 * length across its piece count; otherwise the conventional power-of-two length that does
 * is used.
 */
function resolvePieceLength(totalLengthBytes: number, stats: TorrentStats): number | undefined {
  const pieceCount = stats.total_pieces || 0;
  const largestListedPieceBytes = (stats.pieces || []).reduce((largest, piece) => Math.max(largest, piece.size || 0), 0);

  if (pieceCount <= 0) return largestListedPieceBytes > 0 ? largestListedPieceBytes : undefined;

  if (
    largestListedPieceBytes > 0
    && largestListedPieceBytes * (pieceCount - 1) < totalLengthBytes
    && largestListedPieceBytes * pieceCount >= totalLengthBytes
  ) {
    return largestListedPieceBytes;
  }

  let pieceLengthBytes = MINIMUM_PIECE_LENGTH_BYTES;
  while (pieceLengthBytes * pieceCount < totalLengthBytes) pieceLengthBytes *= 2;
  return pieceLengthBytes;
}

/**
 * Locates the furthest stream reader among the given files and returns how far into its
 * file it is. Files are laid out back to back in the order the instance lists them, which
 * is the torrent's own order. Readers spread over more than one of the files leave it
 * unclear which belongs to this viewer, so no estimate is made.
 */
export function estimatePlaybackFraction(
  torrentFiles: TorrentFile[],
  stats: TorrentStats,
  targetPaths: string[],
  knownPieceLengthBytes?: number
): PlaybackFractionEstimate | undefined {
  const totalLengthBytes = torrentFiles.reduce((total, file) => total + (file.length || 0), 0);
  const pieceLengthBytes = knownPieceLengthBytes || resolvePieceLength(totalLengthBytes, stats);
  if (!pieceLengthBytes) return undefined;

  const targetRanges: Array<{ endBytes: number, path: string, startBytes: number }> = [];
  let offsetBytes = 0;
  for (const file of torrentFiles) {
    const lengthBytes = file.length || 0;
    if (lengthBytes > 0 && targetPaths.includes(file.path)) {
      targetRanges.push({ endBytes: offsetBytes + lengthBytes, path: file.path, startBytes: offsetBytes });
    }
    offsetBytes += lengthBytes;
  }

  const fractionsByPath = new Map<string, number>();
  for (const reader of stats.readers || []) {
    const readerStartBytes = reader.position * pieceLengthBytes;
    const readerEndBytes = readerStartBytes + pieceLengthBytes;
    for (const range of targetRanges) {
      if (readerStartBytes >= range.endBytes || readerEndBytes <= range.startBytes) continue;
      const fraction = Math.min(1, Math.max(0, (readerStartBytes - range.startBytes) / (range.endBytes - range.startBytes)));
      fractionsByPath.set(range.path, Math.max(fractionsByPath.get(range.path) ?? 0, fraction));
    }
  }

  if (fractionsByPath.size !== 1) return undefined;
  const [[path, fraction]] = Array.from(fractionsByPath.entries());
  return { fraction, path };
}

export class ExternalProgress {
  private static readonly AWAY_GAP_MS = 5000;
  private static readonly MAXIMUM_AWAY_MS = 12 * 60 * 60 * 1000;
  private static readonly MINIMUM_FRACTION = 0.02;
  private static readonly MINIMUM_POSITION_SECONDS = 10;
  private static readonly PLAYER_CONNECT_WINDOW_MS = 60 * 1000;
  private static readonly RETURN_GRACE_MS = 2000;
  private static readonly TICK_MS = 1000;

  private static candidate: ExternalPlaybackCandidate | null = null;
  private static isInitialized = false;
  private static isSavingEstimate = false;
  private static lastTickAtMs = 0;
  private static tickIntervalId: ReturnType<typeof setInterval> | null = null;

  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    Lampa.Player?.listener?.follow('external', (data: { torrent_hash?: string }) => this.handleExternalLaunch(data));
    Lampa.Listener?.follow('state:changed', (event: { data?: { hash?: number | string }, reason?: string, target?: string }) => {
      this.handleStateChanged(event);
    });

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.handleAway();
        else this.handleReturn();
      });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('blur', () => this.handleAway());
      window.addEventListener('focus', () => this.handleReturn());
    }
  }

  /**
   * Remembers the playback about to be handed to Lampa's player. It only becomes a
   * candidate for estimation once Lampa reports handing it to an external player.
   */
  public static arm(params: {
    files: ExternalPlaybackFile[],
    instance: TorrPlayInstance,
    movie?: LampaMovie,
    torrentHash: string
  }): void {
    this.stopTicking();
    this.candidate = {
      ...params,
      hasExactReport: false,
      hasSeenActive: false,
      isAway: false,
      isMeasurementPending: false,
      launchedAtMs: null,
    };
  }

  public static resetForTesting(): void {
    this.stopTicking();
    this.candidate = null;
    this.isInitialized = false;
  }

  private static handleExternalLaunch(data: { torrent_hash?: string }): void {
    const candidate = this.candidate;
    if (!candidate || candidate.launchedAtMs !== null || data?.torrent_hash !== candidate.torrentHash) return;

    candidate.launchedAtMs = Date.now();
    this.startTicking();
  }

  private static handleStateChanged(event: { data?: { hash?: number | string }, reason?: string, target?: string }): void {
    const candidate = this.candidate;
    if (!candidate || candidate.launchedAtMs === null || this.isSavingEstimate) return;
    if (event?.target !== 'timeline' || event.reason !== 'update') return;

    const updatedHash = event.data?.hash;
    if (candidate.files.some(file => String(file.hash) === String(updatedHash))) {
      candidate.hasExactReport = true;
    }
  }

  private static handleAway(): void {
    if (this.candidate && this.candidate.launchedAtMs !== null) this.candidate.isAway = true;
  }

  private static handleReturn(): void {
    if (this.candidate && this.candidate.launchedAtMs !== null && this.candidate.isAway) this.scheduleMeasurement();
  }

  private static handleTick(): void {
    const candidate = this.candidate;
    if (!candidate || candidate.launchedAtMs === null) {
      this.stopTicking();
      return;
    }

    const nowMs = Date.now();
    if (nowMs - candidate.launchedAtMs > this.MAXIMUM_AWAY_MS) {
      this.stopTicking();
      this.candidate = null;
      return;
    }

    const elapsedMs = nowMs - this.lastTickAtMs;
    this.lastTickAtMs = nowMs;
    if (elapsedMs > this.AWAY_GAP_MS) {
      candidate.isAway = true;
      // A runtime that only slows a hidden page's timers leaves the same gap while the
      // viewer is still watching, so the gap only marks a return once the page is shown.
      const isPageHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (!isPageHidden) this.scheduleMeasurement();
    }
  }

  private static scheduleMeasurement(): void {
    const candidate = this.candidate;
    if (!candidate || candidate.isMeasurementPending) return;
    candidate.isAway = false;
    candidate.isMeasurementPending = true;
    this.stopTicking();
    // Leave a platform that does report the exact position a moment to deliver it first.
    setTimeout(() => {
      candidate.isMeasurementPending = false;
      if (this.candidate !== candidate) return;
      if (candidate.hasExactReport) {
        this.candidate = null;
        return;
      }
      // The viewer may only have glanced back while a player in its own window keeps
      // playing, so the playback stays tracked and every later return measures again.
      this.startTicking();
      void this.measure(candidate).catch(() => {});
    }, this.RETURN_GRACE_MS);
  }

  private static startTicking(): void {
    this.stopTicking();
    this.lastTickAtMs = Date.now();
    // A platform that stops running the page while another app is in front gives no
    // visibility events; the gap it leaves between these ticks shows the viewer was away.
    this.tickIntervalId = setInterval(() => this.handleTick(), this.TICK_MS);
  }

  private static stopTicking(): void {
    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
  }

  private static async measure(candidate: ExternalPlaybackCandidate): Promise<void> {
    // Reading a single torrent or its statistics loads the torrent onto the instance when it
    // has been dropped, so the side-effect-free listing first confirms a reader is still
    // there; lingering readers count as active.
    const { torrents } = await TorrPlayApi.getTorrents(candidate.instance, { hashes: [candidate.torrentHash] });
    const torrent = (torrents || []).find(
      listedTorrent => listedTorrent.hash.toLowerCase() === candidate.torrentHash.toLowerCase()
    );
    if (!torrent?.active) {
      // Before the player opens its stream there is no reader yet. Once one was seen, or long
      // after any player would have connected, an inactive torrent means every reader this
      // playback had is gone, so nothing more can be learned, and an active torrent seen later
      // would belong to some other playback.
      const hasConnectWindowPassed = Date.now() - (candidate.launchedAtMs ?? 0) > this.PLAYER_CONNECT_WINDOW_MS;
      if ((candidate.hasSeenActive || hasConnectWindowPassed) && this.candidate === candidate) {
        this.stopTicking();
        this.candidate = null;
      }
      return;
    }
    candidate.hasSeenActive = true;
    if (candidate.hasExactReport) return;

    const stats = await TorrPlayApi.getTorrentStats(candidate.instance, candidate.torrentHash);
    if (candidate.hasExactReport) return;

    const estimate = estimatePlaybackFraction(
      torrent.files || [],
      stats,
      candidate.files.map(file => file.path),
      torrent.piece_size
    );
    if (!estimate || estimate.fraction < this.MINIMUM_FRACTION) return;

    const file = candidate.files.find(playbackFile => playbackFile.path === estimate.path);
    if (!file || !Lampa.Timeline) return;

    const view: TimelineView = Lampa.Timeline.view(file.hash);
    const durationSeconds = view.duration && view.duration > 0
      ? view.duration
      : await this.resolveRuntimeSeconds(candidate.movie, file);
    if (candidate.hasExactReport) return;

    const positionSeconds = durationSeconds ? Math.round(estimate.fraction * durationSeconds) : 0;
    if (durationSeconds && positionSeconds <= this.MINIMUM_POSITION_SECONDS) return;

    view.percent = Math.round(estimate.fraction * 100);
    view.duration = durationSeconds || 0;
    view.time = positionSeconds;
    // Lampa announces this update like any other, which must not count as an exact report.
    this.isSavingEstimate = true;
    try {
      Lampa.Timeline.update(view);
    } finally {
      this.isSavingEstimate = false;
    }
  }

  /**
   * The file's duration is unknown to the client, so the catalog's runtime stands in for it,
   * as Lampa itself does when it turns a stored timecode into a percentage.
   */
  private static async resolveRuntimeSeconds(
    movie: LampaMovie | undefined,
    file: ExternalPlaybackFile
  ): Promise<number | undefined> {
    if (!movie) return undefined;

    const isEpisode = Boolean(file.season && file.episode);
    if (!isEpisode) return movie.runtime ? movie.runtime * 60 : undefined;

    const seasons = await fetchSeasonEpisodes(movie, [file.season as number]);
    const episode = seasons[String(file.season)]?.episodes?.find(
      candidateEpisode => candidateEpisode.episode_number === file.episode
    );
    const runtimeMinutes = episode?.runtime || movie.episode_run_time?.[0];
    return runtimeMinutes ? runtimeMinutes * 60 : undefined;
  }
}
