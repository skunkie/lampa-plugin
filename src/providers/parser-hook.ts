// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { translate } from '../lang/translations';
import { ProviderSearchResult } from '../types/provider';
import { attachRowFactory, ProviderResultRowData } from '../ui/provider-result-row';
import { TORRPLAY_ENABLED_STORAGE_KEY } from '../ui/settings-keys';
import { decodeSearchQuery } from '../utils/search-query';
import {
  clearTriggerSetting,
  isTriggerSettingEnabled,
  isTriggerSettingUnset,
  readTriggerSetting,
  writeTriggerSetting,
} from '../utils/trigger-setting';
import {
  PROVIDER_SEARCH_ENABLED_STORAGE_KEY,
  ProviderManager,
  STORAGE_KEY_PROVIDERS,
} from './provider-manager';
import { ProviderSearch, ProviderSearchMovie } from './provider-search';

const NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY = 'parse_in_search';
const NATIVE_GLOBAL_SEARCH_PREFERENCE_STORAGE_KEY = 'torrplay_native_global_search';

interface LampaGlobalSearchSource {
  onCancel: () => void,
  onRecall: (rows: ProviderResultRowData[]) => void,
  onSelect: (params: { element: LampaParserResultItem, line: { toggle: () => void } }) => void,
  params: { lazy: boolean },
  search: (params: { query: string }, onComplete: (rows: ProviderResultRowData[]) => void) => void,
  title: string
}

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
 * torrent list expects (Title, Tracker, Size, size, Seeders, Peers, MagnetUri, Link,
 * InfoHash, hash, source_rank, checked_at, ffprobe, info) — verified against the fields
 * Lampa's own bundled Jackett/Prowlarr/TorrServer parsers populate, and against its
 * `torrent` row template that renders them directly (a
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
    // Media info an indexer supplies about the release itself; Lampa turns it into the
    // per-torrent resolution, channel and audio/subtitle tags on each row.
    ffprobe: result.ffprobe,
    hash,
    info: result.info,
    // The indexer's own info hash, kept apart from `hash` above: that one is a
    // hash of the title and identifies the card, while this identifies the
    // torrent. Keeping it lets hash-only releases play without resolving a download link.
    InfoHash: result.hash,
    languages: result.languages,
    Link: result.downloadUrl,
    MagnetUri: result.magnetUri || '',
    Peers: result.leechers,
    // A missing PublishDate makes Lampa's own Utils.parseTime() produce an Invalid
    // Date (NaN-laced) display string, so fall back to "now" rather than leave it unset.
    PublishDate: publishDate,
    PublisTime: new Date(publishDate).getTime(),
    Seeders: result.seeders,
    size: hasUtils && result.sizeBytes ? Lampa.Utils.bytesToSize(result.sizeBytes) : '',
    Size: result.sizeBytes,
    source_rank: result.sourceRank ?? index,
    Title: result.title,
    Tracker: result.tracker,
    viewed: viewedList.includes(hash),
  };
}

/**
 * Wraps `Lampa.Parser.get` to route torrent search through the TorrPlay provider pool
 * while TorrPlay and at least one provider are enabled. Unlike `Lampa.Torserver`, which TorrPlay
 * deliberately never hooks because it stays fully intact, Lampa itself deletes the
 * native parser UI when `torrents_use = false` — leaving no native surface to preserve,
 * and no non-hook alternative for restoring search.
 */
export class ParserHook {
  private static activeSearchControllers = new Set<AbortController>();
  private static globalSearchSource: LampaGlobalSearchSource | null = null;
  private static isGlobalSearchIntegrated = false;
  private static isGlobalSearchSourceActive = false;
  private static isSyncingGlobalSearch = false;
  private static originalParserClear: (() => void) | null = null;
  private static originalParserGet: ((params: LampaParserParams, onComplete: (data: LampaParserData) => void, onError?: (error?: unknown) => void) => void) | null = null;
  private static shouldEnableNativeGlobalSearch = false;

  public static init(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Parser) return;

    if (!this.originalParserGet && typeof Lampa.Parser.get === 'function') {
      this.originalParserGet = Lampa.Parser.get.bind(Lampa.Parser);
    }
    if (!this.originalParserClear && typeof Lampa.Parser.clear === 'function') {
      this.originalParserClear = Lampa.Parser.clear.bind(Lampa.Parser);
    }

    Lampa.Parser.clear = () => {
      this.activeSearchControllers.forEach(controller => controller.abort());
      this.activeSearchControllers.clear();
      this.originalParserClear?.();
    };

    Lampa.Parser.get = (params: LampaParserParams, onComplete: (data: LampaParserData) => void, onError?: (error?: unknown) => void) => {
      if (!this.isReplacingNativeParser()) {
        if (this.originalParserGet) {
          this.originalParserGet(params, onComplete, onError);
        } else if (onError) {
          onError('No search providers configured');
        }
        return;
      }

      // Lampa's own parser reports nothing at all once its request has been cleared, so
      // callers arriving through this entry point get no abort callback either.
      this.runProviderSearch(params, results => {
        onComplete({ Results: results.map((result, index) => toLampaResultItem(result, index)) });
      }, onError);
    };

    this.initGlobalSearchIntegration();
  }

  /**
   * Runs one aggregated provider search under a controller registered for `Parser.clear`.
   * Exactly one of `onResults`, `onError` or `onAbort` fires, so a caller that needs a
   * terminal signal on cancellation can ask for one.
   */
  private static runProviderSearch(
    params: LampaParserParams,
    onResults: (results: ProviderSearchResult[]) => void,
    onError?: (error?: unknown) => void,
    onAbort?: () => void
  ): void {
    const query = typeof params?.search === 'string' ? params.search : '';
    const controller = new AbortController();
    this.activeSearchControllers.add(controller);
    ProviderSearch.search({
      clarification: params.clarification,
      fromSearch: params.from_search,
      global: params.global,
      movie: toProviderSearchMovie(params.movie),
      other: params.other,
      query,
      signal: controller.signal,
    })
      .then(results => {
        // Providers that answered before the abort landed still fulfil the aggregate, so
        // a cancelled caller must not be handed their now-stale results.
        if (controller.signal.aborted) {
          if (onAbort) onAbort();
          return;
        }
        onResults(results);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          if (onAbort) onAbort();
          return;
        }
        if (onError) onError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        this.activeSearchControllers.delete(controller);
      });
  }

  /**
   * Whether provider search currently stands in for Lampa's own torrent parser.
   */
  public static isReplacingNativeParser(): boolean {
    const isTorrPlayEnabled = typeof Lampa !== 'undefined' && Lampa.Storage
      ? Boolean(Lampa.Storage.get(TORRPLAY_ENABLED_STORAGE_KEY, true))
      : true;
    return isTorrPlayEnabled && ProviderManager.getEnabledProviders().length > 0;
  }

  /**
   * Whether the provider search toggle has anything to switch: a takeover is active and the
   * global search integration that owns the provider tab was actually installed.
   */
  public static isProviderSearchToggleAvailable(): boolean {
    return this.isGlobalSearchIntegrated && this.isReplacingNativeParser();
  }

  private static createGlobalSearchSource(): LampaGlobalSearchSource {
    const title = translate('torrplay_provider_search_title', 'Jackett / Prowlarr');
    return {
      onCancel: () => {
        Lampa.Parser?.clear?.();
      },
      // Lampa caches rows as plain data, so the row factory has to be put back on recall.
      onRecall: rows => {
        rows.forEach(attachRowFactory);
      },
      onSelect: params => {
        Lampa.Torrent.start(params.element, { title: params.element.Title });
        Lampa.Torrent.back(params.line.toggle.bind(params.line));
      },
      // Searched with every query rather than only once the tab is opened, so the tab can show
      // how many torrents were found.
      params: { lazy: false },
      search: (params, onComplete) => {
        // Lampa's search tab stays in its loading state until this callback fires, and a
        // Parser.clear() from any other activity aborts this request, so every outcome —
        // cancellation included — has to settle it.
        this.runProviderSearch({
          from_search: true,
          other: true,
          search: decodeSearchQuery(params.query),
        }, results => {
          onComplete(results.map((result, index) => {
            const row: ProviderResultRowData = { result, results: [toLampaResultItem(result, index)] };
            attachRowFactory(row);
            return row;
          }));
        }, () => onComplete([]), () => onComplete([]));
      },
      title,
    };
  }

  private static initGlobalSearchIntegration(): void {
    if (!Lampa.Search || !Lampa.Storage) return;
    this.isGlobalSearchIntegrated = true;

    this.shouldEnableNativeGlobalSearch = readTriggerSetting(
      NATIVE_GLOBAL_SEARCH_PREFERENCE_STORAGE_KEY,
      Boolean(Lampa.Storage.field(NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY))
    );

    this.syncGlobalSearchSource();
    Lampa.Storage.listener?.follow('change', event => {
      // The sync's own writes would otherwise re-enter it midway.
      if (this.isSyncingGlobalSearch) return;
      if (event.name === NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY) {
        this.shouldEnableNativeGlobalSearch = isTriggerSettingEnabled(event.value);
      }
      if (
        event.name === NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY
        || event.name === PROVIDER_SEARCH_ENABLED_STORAGE_KEY
        || event.name === STORAGE_KEY_PROVIDERS
        || event.name === TORRPLAY_ENABLED_STORAGE_KEY
      ) {
        this.syncGlobalSearchSource();
      }
    });
  }

  private static syncGlobalSearchSource(): void {
    if (!Lampa.Search || !Lampa.Storage) return;

    this.isSyncingGlobalSearch = true;
    try {
      this.applyGlobalSearchState();
    } finally {
      this.isSyncingGlobalSearch = false;
    }
  }

  private static applyGlobalSearchState(): void {
    const shouldReplaceNativeSource = this.isReplacingNativeParser();
    // An unset toggle takes on the native preference the user holds when a takeover begins.
    if (shouldReplaceNativeSource && isTriggerSettingUnset(PROVIDER_SEARCH_ENABLED_STORAGE_KEY)) {
      writeTriggerSetting(PROVIDER_SEARCH_ENABLED_STORAGE_KEY, this.shouldEnableNativeGlobalSearch);
    }
    const shouldShowProviderSource = shouldReplaceNativeSource
      && readTriggerSetting(PROVIDER_SEARCH_ENABLED_STORAGE_KEY);
    // Lampa's own global search source would reach the providers too, through the hooked parser.
    const shouldEnableNativeSearch = shouldReplaceNativeSource ? false : this.shouldEnableNativeGlobalSearch;

    const preferenceToSave = shouldReplaceNativeSource ? this.shouldEnableNativeGlobalSearch : null;
    const storedPreference = isTriggerSettingUnset(NATIVE_GLOBAL_SEARCH_PREFERENCE_STORAGE_KEY)
      ? null
      : readTriggerSetting(NATIVE_GLOBAL_SEARCH_PREFERENCE_STORAGE_KEY);
    if (storedPreference !== preferenceToSave) {
      if (preferenceToSave === null) {
        clearTriggerSetting(NATIVE_GLOBAL_SEARCH_PREFERENCE_STORAGE_KEY);
      } else {
        writeTriggerSetting(NATIVE_GLOBAL_SEARCH_PREFERENCE_STORAGE_KEY, preferenceToSave);
      }
    }
    const nativeSearchEnabled = Boolean(Lampa.Storage.field(NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY));
    if (nativeSearchEnabled !== shouldEnableNativeSearch) {
      writeTriggerSetting(NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY, shouldEnableNativeSearch);
    }

    if (shouldShowProviderSource && !this.isGlobalSearchSourceActive) {
      this.globalSearchSource ||= this.createGlobalSearchSource();
      Lampa.Search?.addSource(this.globalSearchSource);
      this.isGlobalSearchSourceActive = true;
    } else if (!shouldShowProviderSource && this.isGlobalSearchSourceActive) {
      if (this.globalSearchSource) Lampa.Search?.removeSource(this.globalSearchSource);
      this.isGlobalSearchSourceActive = false;
    }
  }
}
