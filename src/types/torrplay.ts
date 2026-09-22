// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

export type TorrentStorage = 'memory' | 'file';

type AuthType = 'none' | 'basic' | 'bearer';

export interface TorrPlayInstance {
  authType: AuthType,
  enableDownloader?: boolean,
  fileStoragePath?: string,
  id: string,
  jwtExpiresAtMs?: number,
  jwtToken?: string,
  latencyMs?: number,
  name: string,
  password?: string,
  playbackToken?: string,
  playbackTokenExpiresAtMs?: number,
  status?: 'online' | 'offline' | 'checking' | 'unknown',
  url: string,
  username?: string
}

export interface TorrPlaySettings {
  [key: string]: unknown,
  enable_downloader?: boolean,
  file_storage_path?: string
}

export interface TorrentFile {
  length: number,
  name: string,
  path: string
}

export interface Torrent {
  active?: boolean,
  created_at?: string,
  data?: string,
  files: TorrentFile[],
  hash: string,
  magnet?: string,
  name: string,
  poster?: string,
  storage: TorrentStorage,
  title?: string,
  total_size: number,
  totalSize?: number,
  updated_at?: string
}

export interface TorrentsResponse {
  torrents: Torrent[],
  total?: number
}

export interface TorrentAdd {
  hash?: string,
  magnet?: string,
  poster?: string,
  storage?: TorrentStorage,
  title?: string
}

export interface TorrentResolutionRequest {
  url: string
}

export interface TorrentUpdate {
  storage: TorrentStorage
}

export interface PreloadRequest {
  file_index?: number,
  file_path?: string,
  magnet?: string
}

export interface PreloadResponse {
  active_peers?: number,
  completed_bytes?: number,
  connected_seeders?: number,
  download_rate?: number,
  preload_size?: number,
  preloaded_bytes?: number,
  progress?: number,
  status: 'idle' | 'preloading' | 'ready',
  target_bytes?: number,
  total_peers?: number
}

export interface TokenResponse {
  access_token: string,
  expires_in?: number
}

export interface ScopedToken {
  expires_at: string,
  token: string
}

export interface ParsedFileInfo {
  episode: number | null,
  hash: number | string,
  season: number | null,
  serial: boolean
}

export interface PlayOptions {
  saveToDb: boolean,
  storage: TorrentStorage
}
