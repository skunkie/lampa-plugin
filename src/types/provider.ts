// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

export type ProviderType = 'jackett' | 'prowlarr';

export interface TorrentProvider {
  apiKey?: string,
  id: string,
  isEnabled: boolean,
  latencyMs?: number,
  name: string,
  status?: 'online' | 'offline' | 'checking' | 'unknown',
  type: ProviderType,
  url: string
}

export interface ProviderHealthResult {
  isOk: boolean,
  latencyMs?: number,
  statusMessage?: string
}

export interface ProviderSearchResult {
  category?: number[],
  comments?: string,
  detailsUrl?: string,
  downloadUrl?: string,
  ffprobe?: LampaFfprobeStream[],
  hash?: string,
  info?: ProviderSearchInfo,
  languages?: string[],
  leechers: number,
  magnetUri?: string,
  providerId: string,
  providerName: string,
  publishedAt?: string,
  seeders: number,
  sizeBytes?: number,
  sourceRank?: number,
  title: string,
  tracker?: string
}

export interface ProviderSearchInfo {
  quality?: number,
  voices?: string[]
}
