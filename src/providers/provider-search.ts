// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { requestHttp } from '../api/http-client';
import { normalizeInfoHash } from '../api/torrplay';
import { ProviderManager } from '../providers/provider-manager';
import { ProviderSearchInfo, ProviderSearchResult, TorrentProvider } from '../types/provider';

export interface ProviderSearchMovie {
  genres?: Array<{ id: number, name: string }>,
  numberOfSeasons?: number,
  originalLanguage?: string,
  originalName?: string,
  originalTitle?: string,
  releaseDate?: string,
  title?: string
}

export interface ProviderSearchQuery {
  clarification?: boolean,
  fromSearch?: boolean,
  global?: boolean,
  movie?: ProviderSearchMovie,
  other?: boolean,
  query: string,
  timeoutSeconds?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function readSearchInfo(value: unknown): ProviderSearchInfo | undefined {
  if (!isRecord(value)) return undefined;
  const voices = readStringArray(value.voices);
  return voices ? { voices } : undefined;
}

function isAnimeMovie(movie?: ProviderSearchMovie): boolean {
  return Boolean(
    movie &&
    (movie.originalLanguage === 'ja' || movie.originalLanguage === 'zh') &&
    movie.genres?.some(genre => genre.id === 16)
  );
}

function searchCategories(searchQuery: ProviderSearchQuery): number[] {
  if (searchQuery.fromSearch || searchQuery.global || !searchQuery.movie) return [];
  const categories = [searchQuery.movie.numberOfSeasons && searchQuery.movie.numberOfSeasons > 0 ? 5000 : 2000];
  if (isAnimeMovie(searchQuery.movie)) categories.push(5070);
  return categories;
}

function appendMovieContext(params: URLSearchParams, searchQuery: ProviderSearchQuery): void {
  const movie = searchQuery.movie;
  if (searchQuery.fromSearch || !movie) return;

  if (!searchQuery.clarification) {
    if (movie.title) params.set('title', movie.title);
    if (movie.originalTitle) params.set('title_original', movie.originalTitle);
  }

  const releaseDate = movie.releaseDate || '0000';
  params.set('genres', (movie.genres || []).map(genre => genre.name).join(','));
  params.set('is_serial', movie.originalName ? '2' : (searchQuery.other ? '0' : '1'));
  params.set('year', releaseDate.slice(0, 4));
}

function mapJackettResult(raw: Record<string, unknown>, provider: TorrentProvider): ProviderSearchResult {
  const link = readString(raw.Link);
  return {
    category: Array.isArray(raw.Category) && raw.Category.every(category => typeof category === 'number')
      ? raw.Category
      : undefined,
    comments: readString(raw.Comments),
    detailsUrl: readString(raw.Guid),
    downloadUrl: link,
    hash: normalizeInfoHash(raw.InfoHash) || undefined,
    info: readSearchInfo(raw.Info) || readSearchInfo(raw.info),
    languages: readStringArray(raw.Languages) || readStringArray(raw.languages),
    leechers: Number(raw.Peers) || 0,
    magnetUri: readString(raw.MagnetUri) || (link && /^magnet:/i.test(link) ? link : undefined),
    providerId: provider.id,
    providerName: provider.name,
    publishedAt: readString(raw.PublishDate),
    seeders: Number(raw.Seeders) || 0,
    sizeBytes: typeof raw.Size === 'number' ? raw.Size : undefined,
    title: readString(raw.Title) || '',
    tracker: readString(raw.Tracker) || provider.name,
  };
}

function mapProwlarrResult(raw: Record<string, unknown>, provider: TorrentProvider): ProviderSearchResult {
  const downloadUrl = readString(raw.downloadUrl);
  return {
    detailsUrl: readString(raw.infoUrl),
    downloadUrl,
    hash: normalizeInfoHash(raw.infoHash) || undefined,
    info: readSearchInfo(raw.info),
    languages: readStringArray(raw.languages),
    leechers: Number(raw.leechers) || 0,
    magnetUri: downloadUrl && /^magnet:/i.test(downloadUrl) ? downloadUrl : undefined,
    providerId: provider.id,
    providerName: provider.name,
    publishedAt: readString(raw.publishDate),
    seeders: Number(raw.seeders) || 0,
    sizeBytes: typeof raw.size === 'number' ? raw.size : undefined,
    title: readString(raw.title) || '',
    tracker: readString(raw.indexer) || provider.name,
  };
}

/**
 * Deduplication key mirroring Lampa's own `resultKey` (src/core/api/sources/parser.js):
 * prefer the magnet URI, else a fingerprint of hash/size/tracker.
 */
function dedupeKey(result: ProviderSearchResult): string {
  if (result.magnetUri) return `m:${result.magnetUri.toLowerCase()}`;
  return `h:${result.hash || ''}|${result.sizeBytes || 0}|${result.tracker || ''}|${result.title}`;
}

export class ProviderSearch {
  /**
   * Queries a single Jackett provider's native JSON aggregate-search endpoint
   * (the same endpoint Lampa's own bundled Jackett client uses).
   */
  private static async searchJackett(
    provider: TorrentProvider,
    searchQuery: ProviderSearchQuery,
    timeoutMs: number
  ): Promise<ProviderSearchResult[]> {
    const baseUrl = provider.url.replace(/\/+$/, '');
    const params = new URLSearchParams({
      apikey: provider.apiKey || '',
      Query: searchQuery.query,
    });
    appendMovieContext(params, searchQuery);
    const categories = searchCategories(searchQuery);
    if (categories.length > 0) params.set('Category[]', categories.join(','));
    const url = `${baseUrl}/api/v2.0/indexers/all/results?${params.toString()}`;
    const response = await requestHttp(url, { method: 'GET', timeoutMs });
    if (!response.ok) return [];
    const json = await response.json();
    const results = isRecord(json) && Array.isArray(json.Results) ? json.Results.filter(isRecord) : [];
    return results.map(raw => mapJackettResult(raw, provider));
  }

  /**
   * Queries a single Prowlarr provider's native search endpoint.
   */
  private static async searchProwlarr(
    provider: TorrentProvider,
    searchQuery: ProviderSearchQuery,
    timeoutMs: number
  ): Promise<ProviderSearchResult[]> {
    const baseUrl = provider.url.replace(/\/+$/, '');
    const params = new URLSearchParams({
      apikey: provider.apiKey || '',
      query: searchQuery.query,
    });
    if (!searchQuery.fromSearch) {
      searchCategories(searchQuery).forEach(category => params.append('categories', String(category)));
      params.set('type', searchQuery.movie?.originalName ? 'tvsearch' : 'search');
    }
    const url = `${baseUrl}/api/v1/search?${params.toString()}`;
    const response = await requestHttp(url, { method: 'GET', timeoutMs });
    if (!response.ok) return [];
    const json = await response.json();
    const results = Array.isArray(json) ? json.filter(isRecord) : [];
    return results
      .filter(raw => raw.protocol === 'torrent')
      .map(raw => mapProwlarrResult(raw, provider));
  }

  private static async searchProvider(
    provider: TorrentProvider,
    searchQuery: ProviderSearchQuery,
    timeoutMs: number
  ): Promise<ProviderSearchResult[]> {
    try {
      return provider.type === 'prowlarr'
        ? await this.searchProwlarr(provider, searchQuery, timeoutMs)
        : await this.searchJackett(provider, searchQuery, timeoutMs);
    } catch {
      // A single failing/timing-out provider must not abort the aggregated search.
      return [];
    }
  }

  /**
   * Queries all enabled providers in parallel, merges, deduplicates, and ranks results
   * by seed count descending.
   */
  public static async search(searchQuery: ProviderSearchQuery): Promise<ProviderSearchResult[]> {
    const providers = ProviderManager.getEnabledProviders();
    if (providers.length === 0) return [];

    const timeoutMs = (searchQuery.timeoutSeconds ?? 15) * 1000;
    const perProviderResults = await Promise.all(
      providers.map(provider => this.searchProvider(provider, searchQuery, timeoutMs))
    );

    const byKey = new Map<string, ProviderSearchResult>();
    for (const result of perProviderResults.flat()) {
      const key = dedupeKey(result);
      const existing = byKey.get(key);
      if (!existing || result.seeders > existing.seeders) {
        byKey.set(key, result);
      }
    }

    return [...byKey.values()].sort((first, second) => second.seeders - first.seeders);
  }
}
