// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import {
  PreloadRequest,
  PreloadResponse,
  Torrent,
  TorrentAdd,
  TorrentsResponse,
  TorrentUpdate,
  TorrPlayInstance,
  TorrPlaySettings,
} from '../types/torrplay';
import { AuthManager } from './auth';
import { requestHttp } from './http-client';

export class TorrPlayApiError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TorrPlayApiError';
    this.status = status;
  }
}

/**
 * Normalizes a candidate info hash to a lowercase 40-character hexadecimal string.
 * Supports 40-character hex and 32-character base32 representations.
 * Returns null if candidate is undefined, empty, or not a valid info hash.
 */
export function normalizeInfoHash(candidate?: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (/^[0-9a-fA-F]{40}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^[a-zA-Z2-7]{32}$/.test(trimmed)) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
    let bits = 0;
    let value = 0;
    let hex = '';

    for (let i = 0; i < trimmed.length; i++) {
      const idx = alphabet.indexOf(trimmed[i].toLowerCase());
      if (idx === -1) return null;
      value = (value << 5) | idx;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        const byte = (value >>> bits) & 0xff;
        hex += byte.toString(16).padStart(2, '0');
      }
    }

    return hex.length === 40 ? hex : null;
  }
  return null;
}

/**
 * Reduces a magnet URI to the parameters the stream route consumes: the exact topic,
 * which the server validates against the hash in the request path, and the trackers it
 * registers to bootstrap discovery. A release title travels as a display name that no
 * route reads, yet it is percent-encoded twice on its way into the query string and can
 * grow the stream URL past what external players accept. Parameter keys are matched
 * case-insensitively, matching how the info hash is read elsewhere. Returns null when no
 * exact topic is present, since the server rejects such a magnet rather than ignoring it.
 */
export function buildStreamMagnet(magnetUri?: string): string | null {
  if (!magnetUri) return null;

  const queryStart = magnetUri.indexOf('?');
  if (queryStart < 0) return null;

  const parameterKey = (parameter: string): string => parameter.split('=')[0].toLowerCase();

  const retainedParameters = magnetUri
    .slice(queryStart + 1)
    .split('&')
    .filter(parameter => {
      const key = parameterKey(parameter);
      return key === 'xt' || key === 'tr';
    });

  const hasExactTopic = retainedParameters.some(parameter => parameterKey(parameter) === 'xt');
  if (!hasExactTopic) return null;

  return `magnet:?${retainedParameters.join('&')}`;
}

export function extractHashFromMagnet(magnetUri: string): string | null {
  if (!magnetUri) return null;
  const match = magnetUri.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
  if (!match) return null;
  return normalizeInfoHash(match[1]);
}

// The instance waits for torrent metadata before it answers a preload start. It bounds that
// wait itself and answers 504 once the bound lapses, so this window only has to outlast the
// bound rather than abandoning a call the instance is still working on.
const PRELOAD_START_TIMEOUT_MS = 45000;

export class TorrPlayApi {
  /**
   * Health check and latency measurement via GET /api/system/health.
   */
  public static async checkHealth(
    instance: TorrPlayInstance,
    timeoutMs = 4000
  ): Promise<{ isOk: boolean, latencyMs: number }> {
    const startedAtMs = performance.now();

    try {
      const url = `${instance.url.replace(/\/+$/, '')}/api/system/health`;
      const response = await requestHttp(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'GET',
        timeoutMs,
      });

      const latencyMs = Math.round(performance.now() - startedAtMs);

      if (response.ok) {
        instance.status = 'online';
        instance.latencyMs = latencyMs;
        return { isOk: true, latencyMs };
      } else {
        instance.status = 'offline';
        instance.latencyMs = Infinity;
        return { isOk: false, latencyMs: Infinity };
      }
    } catch {
      instance.status = 'offline';
      instance.latencyMs = Infinity;
      return { isOk: false, latencyMs: Infinity };
    }
  }

  /**
   * Dispatches an authenticated request to an instance.
   */
  private static async request<T>(
    instance: TorrPlayInstance,
    path: string,
    options: RequestInit & { timeoutMs?: number } = {},
    shouldRetryAuthentication = true
  ): Promise<T> {
    const authHeaders = await AuthManager.getAuthHeaders(instance);
    const url = `${instance.url.replace(/\/+$/, '')}${path.startsWith('/') ? path : '/' + path}`;

    const headers: Record<string, string> = {
      ...authHeaders,
      ...(options.headers as Record<string, string>),
    };

    const response = await requestHttp(url, {
      body: options.body as string | undefined,
      headers,
      method: options.method || 'GET',
      timeoutMs: options.timeoutMs,
    });

    if (response.status === 401 && shouldRetryAuthentication && instance.authType === 'bearer') {
      instance.jwtToken = undefined;
      return this.request<T>(instance, path, options, false);
    }

    if (!response.ok) {
      let errorDetail = `${response.status} ${response.statusText || ''}`.trim();
      try {
        const errorJson = await response.json();
        if (typeof errorJson === 'object' && errorJson !== null) {
          const errorBody = errorJson as Record<string, unknown>;
          const message = typeof errorBody.message === 'string'
            ? errorBody.message
            : (typeof errorBody.error === 'string' ? errorBody.error : undefined);
          if (message) errorDetail = message;
        }
      } catch {} // Non-JSON or malformed error body — status text fallback is already set above.
      throw new TorrPlayApiError(`TorrPlay API error (${path}): ${errorDetail}`, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  /**
   * Adds a torrent via POST /api/v1/torrents.
   */
  public static async addTorrent(
    instance: TorrPlayInstance,
    torrentRequest: TorrentAdd
  ): Promise<Torrent> {
    const rawMagnet = torrentRequest.magnet?.trim();
    const isMagnet = Boolean(rawMagnet && rawMagnet.toLowerCase().startsWith('magnet:'));
    const magnetUri = isMagnet ? rawMagnet : undefined;
    const magnetHash = magnetUri ? extractHashFromMagnet(magnetUri) : null;
    const hash = normalizeInfoHash(torrentRequest.hash) || magnetHash;

    const payload: TorrentAdd = {
      ...torrentRequest,
    };

    if (magnetUri) {
      payload.magnet = magnetUri;
    } else {
      delete payload.magnet;
    }

    if (hash) {
      payload.hash = hash;
    } else {
      delete payload.hash;
    }

    try {
      return await this.request<Torrent>(instance, '/api/v1/torrents', {
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
    } catch (err: unknown) {
      const isConflict =
        (err instanceof TorrPlayApiError && err.status === 409) ||
        (err instanceof Error && (
          err.message.includes('409') ||
          err.message.toLowerCase().includes('already exists') ||
          err.message.toLowerCase().includes('conflict')
        ));

      if (isConflict && hash) {
        return this.getTorrent(instance, hash);
      }
      throw err;
    }
  }

  /**
   * Retrieves torrents via GET /api/v1/torrents. The listing covers the database
   * plus any torrent merely loaded in the torrent client, so entries without a
   * `created_at` stamp are client-only and not persisted. `hashes` narrows the
   * listing server-side to the given info hashes.
   */
  public static async getTorrents(
    instance: TorrPlayInstance,
    pagination?: { hashes?: string[], limit?: number, offset?: number }
  ): Promise<TorrentsResponse> {
    const query = new URLSearchParams();
    if (pagination?.hashes?.length) query.append('hashes', pagination.hashes.join(','));
    if (pagination?.limit) query.append('limit', pagination.limit.toString());
    if (pagination?.offset) query.append('offset', pagination.offset.toString());
    const queryString = query.toString();
    const endpoint = `/api/v1/torrents${queryString ? `?${queryString}` : ''}`;
    return this.request<TorrentsResponse>(instance, endpoint, {
      method: 'GET',
    });
  }

  /**
   * Retrieves torrent metadata and files via GET /api/v1/torrents/{hash}.
   * Never persists the torrent to the database. When the torrent is not yet
   * known to the instance, passing its magnet registers the magnet's own
   * trackers instead of falling back to a bare-hash (DHT/PEX-only) lookup.
   */
  public static async getTorrent(
    instance: TorrPlayInstance,
    hash: string,
    magnet?: string
  ): Promise<Torrent> {
    const query = magnet ? `?magnet=${encodeURIComponent(magnet)}` : '';
    return this.request<Torrent>(instance, `/api/v1/torrents/${hash}${query}`, {
      method: 'GET',
    });
  }

  /**
   * Removes a torrent from TorrPlay database via DELETE /api/v1/torrents/{hash}.
   */
  public static async deleteTorrent(
    instance: TorrPlayInstance,
    hash: string
  ): Promise<void> {
    return this.request<void>(instance, `/api/v1/torrents/${hash}`, {
      method: 'DELETE',
    });
  }

  /**
   * Updates torrent metadata (e.g. storage type) via PATCH /api/v1/torrents/{hash}.
   */
  public static async updateTorrent(
    instance: TorrPlayInstance,
    hash: string,
    torrentUpdate: TorrentUpdate
  ): Promise<Torrent> {
    return this.request<Torrent>(instance, `/api/v1/torrents/${hash}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(torrentUpdate),
    });
  }

  /**
   * Retrieves instance application settings via GET /api/v1/settings.
   */
  public static async getSettings(
    instance: TorrPlayInstance
  ): Promise<TorrPlaySettings> {
    return this.request<TorrPlaySettings>(instance, '/api/v1/settings', {
      method: 'GET',
    });
  }

  /**
   * Updates instance application settings (e.g. file_storage_path) via PATCH /api/v1/settings.
   */
  public static async updateSettings(
    instance: TorrPlayInstance,
    settings: TorrPlaySettings
  ): Promise<void> {
    return this.request<void>(instance, '/api/v1/settings', {
      body: JSON.stringify(settings),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    });
  }

  /**
   * Initiates preload via PUT /api/v1/torrents/{hash}/preload. The instance answers only
   * once it holds the torrent's metadata, and waits for it well past the ordinary request
   * window, so this call is given one wide enough to cover that wait and its 504.
   */
  public static async startPreload(
    instance: TorrPlayInstance,
    hash: string,
    preloadRequest: PreloadRequest
  ): Promise<PreloadResponse> {
    return this.request<PreloadResponse>(instance, `/api/v1/torrents/${hash}/preload`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preloadRequest),
      timeoutMs: PRELOAD_START_TIMEOUT_MS,
    });
  }

  /**
   * Retrieves current preload status via GET /api/v1/torrents/{hash}/preload.
   */
  public static async getPreload(
    instance: TorrPlayInstance,
    hash: string
  ): Promise<PreloadResponse> {
    return this.request<PreloadResponse>(instance, `/api/v1/torrents/${hash}/preload`, {
      method: 'GET',
    });
  }

  /**
   * Cancels preload via DELETE /api/v1/torrents/{hash}/preload.
   */
  public static async cancelPreload(
    instance: TorrPlayInstance,
    hash: string
  ): Promise<void> {
    return this.request<void>(instance, `/api/v1/torrents/${hash}/preload`, {
      method: 'DELETE',
    });
  }

  /**
   * Builds the full streaming URL with playback token attached.
   */
  public static async getStreamUrl(
    instance: TorrPlayInstance,
    hash: string,
    fileIdentifier: { index?: number, magnet?: string, path?: string }
  ): Promise<string> {
    const baseUrl = instance.url.replace(/\/+$/, '');
    let fileQueryParameter = '';

    if (fileIdentifier.index !== undefined) {
      fileQueryParameter = `index=${fileIdentifier.index}`;
    } else if (fileIdentifier.path) {
      fileQueryParameter = `path=${encodeURIComponent(fileIdentifier.path)}`;
    }

    let streamUrl = `${baseUrl}/api/v1/stream/${hash}?${fileQueryParameter}`;

    const bootstrapMagnet = buildStreamMagnet(fileIdentifier.magnet);
    if (bootstrapMagnet) {
      streamUrl += `&magnet=${encodeURIComponent(bootstrapMagnet)}`;
    }

    const playbackToken = await AuthManager.getPlaybackToken(instance);
    if (playbackToken) {
      streamUrl += `&token=${encodeURIComponent(playbackToken)}`;
    }

    return streamUrl;
  }
}
