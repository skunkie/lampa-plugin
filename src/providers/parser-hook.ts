// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { ProviderSearchResult } from '../types/provider';
import { TORRPLAY_ENABLED_STORAGE_KEY } from '../ui/settings';
import { ProviderManager } from './provider-manager';
import { ProviderSearch, ProviderSearchMovie } from './provider-search';

function toProviderSearchMovie(movie?: LampaMovie): ProviderSearchMovie | undefined {
  if (!movie) return undefined;
  return {
    genres: movie.genres,
    numberOfSeasons: movie.number_of_seasons,
    originalLanguage: movie.original_language,
    originalName: movie.original_name,
    originalTitle: movie.original_title,
    releaseDate: movie.first_air_date || movie.release_date,
    title: movie.title || movie.name,
  };
}

/**
 * Maps our internal search result back into the raw item shape Lampa's native
 * torrent list/card renderer expects (Title, Tracker, Size, size, Seeders, Peers,
 * MagnetUri, Link, hash, source_rank, checked_at) — verified against the fields
 * Lampa's own bundled Jackett/Prowlarr/TorrServer parsers already populate, and
 * against its card_parser/torrent-item templates that render them directly (a
 * field left out here renders as the literal string "undefined" in the UI, since
 * Lampa's templating does plain string interpolation with no fallback).
 */
function toLampaResultItem(result: ProviderSearchResult, index: number): LampaParserResultItem {
  const hasUtils = typeof Lampa !== 'undefined' && Boolean(Lampa.Utils);
  const hash = hasUtils ? Lampa.Utils.hash(result.title) : result.title;
  const publishDate = result.publishedAt || new Date().toISOString();
  const viewedList = typeof Lampa !== 'undefined' && Lampa.Storage
    ? Lampa.Storage.get<string[]>('torrents_view', [])
    : [];
  return {
    checked_at: Date.now(),
    hash,
    info: result.info,
    Link: result.downloadUrl,
    languages: result.languages,
    MagnetUri: result.magnetUri || '',
    Peers: result.leechers,
    // A missing PublishDate makes Lampa's own Utils.parseTime() produce an Invalid
    // Date (NaN-laced) display string, so fall back to "now" rather than leave it unset.
    PublisTime: new Date(publishDate).getTime(),
    PublishDate: publishDate,
    Seeders: result.seeders,
    Size: result.sizeBytes,
    size: hasUtils && result.sizeBytes ? Lampa.Utils.bytesToSize(result.sizeBytes) : '',
    source_rank: result.sourceRank ?? index,
    Title: result.title,
    Tracker: result.tracker,
    viewed: viewedList.includes(hash),
  };
}

/**
 * Wraps `Lampa.Parser.get` to route torrent search through the TorrPlay provider pool
 * when at least one provider is configured. Unlike `Lampa.Torserver`, which TorrPlay
 * deliberately never hooks because it stays fully intact, Lampa itself deletes the
 * native parser UI when `torrents_use = false` — leaving no native surface to preserve,
 * and no non-hook alternative for restoring search.
 */
export class ParserHook {
  private static originalParserGet: ((params: LampaParserParams, onComplete: (data: LampaParserData) => void, onError?: (error?: unknown) => void) => void) | null = null;

  public static init(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Parser) return;

    if (!this.originalParserGet && typeof Lampa.Parser.get === 'function') {
      this.originalParserGet = Lampa.Parser.get.bind(Lampa.Parser);
    }

    Lampa.Parser.get = (params: LampaParserParams, onComplete: (data: LampaParserData) => void, onError?: (error?: unknown) => void) => {
      const isTorrPlayEnabled = typeof Lampa !== 'undefined' && Lampa.Storage
        ? Lampa.Storage.get(TORRPLAY_ENABLED_STORAGE_KEY, true)
        : true;
      const providers = ProviderManager.getEnabledProviders();

      if (!isTorrPlayEnabled || providers.length === 0) {
        if (this.originalParserGet) {
          this.originalParserGet(params, onComplete, onError);
        } else if (onError) {
          onError('No search providers configured');
        }
        return;
      }

      const query = typeof params?.search === 'string' ? params.search : '';
      ProviderSearch.search({
        clarification: params.clarification,
        fromSearch: params.from_search,
        global: params.global,
        movie: toProviderSearchMovie(params.movie),
        other: params.other,
        query,
      })
        .then(results => {
          onComplete({ Results: results.map((result, index) => toLampaResultItem(result, index)) });
        })
        .catch((error: unknown) => {
          if (onError) onError(error instanceof Error ? error.message : String(error));
        });
    };
  }
}
