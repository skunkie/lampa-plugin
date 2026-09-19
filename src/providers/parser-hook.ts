// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { ProviderSearchResult } from '../types/provider';
import { TORRPLAY_ENABLED_STORAGE_KEY } from '../ui/settings';
import {
  GLOBAL_SEARCH_ENABLED_STORAGE_KEY,
  ProviderManager,
  STORAGE_KEY_PROVIDERS,
} from './provider-manager';
import { ProviderSearch, ProviderSearchMovie } from './provider-search';

const NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY = 'parse_in_search';

// Lampa's settings toggles persist their value as the string 'true'/'false', and its
// Storage.get() funnels every read through `value || fallback || ''`. A raw boolean
// false therefore reads back as the caller's fallback instead of as false, and a key
// that was never written reads back as this empty string instead of as undefined.
// Round-tripping these keys as strings keeps both reads honest and matches exactly what
// the settings UI writes when the user flips the same toggle by hand.
const UNSET_TRIGGER_SETTING = '';

interface LampaGlobalSearchSource {
  onCancel: () => void,
  onMore: (params: { query: string }, close: () => void) => void,
  onRecall: (data: Array<{ results: LampaParserResultItem[] }>) => void,
  onSelect: (params: { element: LampaParserResultItem, line: { toggle: () => void } }) => void,
  params: { lazy: boolean },
  search: (params: { query: string }, onComplete: (data: unknown[]) => void) => void,
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
 * torrent list/card renderer expects (Title, Tracker, Size, size, Seeders, Peers,
 * MagnetUri, Link, InfoHash, hash, source_rank, checked_at, ffprobe, info) — verified
 * against the fields Lampa's own bundled Jackett/Prowlarr/TorrServer parsers populate, and
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
    // Media info an indexer supplies about the release itself; Lampa turns it into the
    // per-torrent resolution, channel and audio/subtitle tags on each row.
    ffprobe: result.ffprobe,
    hash,
    info: result.info,
    // The indexer's own info hash, kept apart from `hash` above: that one is a
    // hash of the title and identifies the card, while this identifies the
    // torrent. Without it a release the indexer described by hash alone, with no
    // magnet to read one out of, reaches playback looking like it has no source
    // but its download link -- which the non-persisting path cannot use.
    InfoHash: result.hash,
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

function addCardParserFactory(item: LampaParserResultItem): void {
  (item as LampaParserResultItem & { params?: unknown }).params = {
    createInstance: (candidate: LampaParserResultItem) => {
      const CardParser = Lampa.Maker?.get('CardParser', candidate);
      return CardParser ? new CardParser(candidate) : new Lampa.Card(candidate);
    },
  };
}

function isTriggerSettingEnabled(value: unknown): boolean {
  return value === true || value === 'true';
}

function readTriggerSetting(key: string): boolean {
  return isTriggerSettingEnabled(Lampa.Storage.get<boolean | string>(key, UNSET_TRIGGER_SETTING));
}

function isTriggerSettingUnset(key: string): boolean {
  return Lampa.Storage.get<boolean | string>(key, UNSET_TRIGGER_SETTING) === UNSET_TRIGGER_SETTING;
}

function writeTriggerSetting(key: string, value: boolean): void {
  Lampa.Storage.set(key, value ? 'true' : 'false');
}

function decodeSearchQuery(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Wraps `Lampa.Parser.get` to route torrent search through the TorrPlay provider pool
 * when at least one provider is configured. Unlike `Lampa.Torserver`, which TorrPlay
 * deliberately never hooks because it stays fully intact, Lampa itself deletes the
 * native parser UI when `torrents_use = false` — leaving no native surface to preserve,
 * and no non-hook alternative for restoring search.
 */
export class ParserHook {
  private static activeSearchControllers = new Set<AbortController>();
  private static globalSearchSource: LampaGlobalSearchSource | null = null;
  private static isGlobalSearchSourceActive = false;
  private static isManagingNativeGlobalSearch = false;
  private static originalParserClear: (() => void) | null = null;
  private static originalParserGet: ((params: LampaParserParams, onComplete: (data: LampaParserData) => void, onError?: (error?: unknown) => void) => void) | null = null;

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

      // Lampa's own parser reports nothing at all once its request has been cleared, so
      // callers arriving through this entry point get no abort callback either.
      this.runProviderSearch(params, onComplete, onError);
    };

    this.initGlobalSearchIntegration();
  }

  /**
   * Runs one aggregated provider search under a controller registered for `Parser.clear`.
   * Exactly one of `onComplete`, `onError` or `onAbort` fires, so a caller that needs a
   * terminal signal on cancellation can ask for one.
   */
  private static runProviderSearch(
    params: LampaParserParams,
    onComplete: (data: LampaParserData) => void,
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
        onComplete({ Results: results.map((result, index) => toLampaResultItem(result, index)) });
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

  private static createGlobalSearchSource(): LampaGlobalSearchSource {
    const title = Lampa.Lang?.translate('title_parser') || 'Torrents';
    return {
      onCancel: () => {
        Lampa.Parser?.clear?.();
      },
      onMore: (params, close) => {
        close();
        Lampa.Activity.push({
          component: 'torrents',
          from_search: true,
          page: 1,
          search: params.query,
          title: Lampa.Lang?.translate('title_torrents') || title,
          url: '',
        });
      },
      onRecall: data => {
        data[0]?.results.forEach(addCardParserFactory);
      },
      onSelect: params => {
        Lampa.Torrent.start(params.element, { title: params.element.Title });
        Lampa.Torrent.back(params.line.toggle.bind(params.line));
      },
      params: { lazy: true },
      search: (params, onComplete) => {
        // Lampa's search tab stays in its loading state until this callback fires, and a
        // Parser.clear() from any other activity aborts this request, so every outcome —
        // cancellation included — has to settle it.
        this.runProviderSearch({
          from_search: true,
          other: true,
          search: decodeSearchQuery(params.query),
        }, data => {
          const results = data.Results
            .sort((first, second) => (second.Seeders || 0) - (first.Seeders || 0))
            .slice(0, 20);
          results.forEach(addCardParserFactory);
          onComplete(results.length > 0 ? [{
            results,
            title,
            total: data.Results.length,
            total_pages: Math.ceil(data.Results.length / 20),
          }] : []);
        }, () => onComplete([]), () => onComplete([]));
      },
      title,
    };
  }

  private static initGlobalSearchIntegration(): void {
    if (!Lampa.Search || !Lampa.Storage) return;

    if (isTriggerSettingUnset(GLOBAL_SEARCH_ENABLED_STORAGE_KEY)) {
      writeTriggerSetting(
        GLOBAL_SEARCH_ENABLED_STORAGE_KEY,
        Boolean(Lampa.Storage.field(NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY))
      );
    }

    this.syncGlobalSearchSource();
    Lampa.Storage.listener?.follow('change', event => {
      if (event.name === NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY && this.isManagingNativeGlobalSearch) return;
      if (event.name === NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY) {
        // The change event carries the value exactly as it was stored, so a switched-off
        // toggle arrives here as the string 'false', which is truthy on its own.
        writeTriggerSetting(GLOBAL_SEARCH_ENABLED_STORAGE_KEY, isTriggerSettingEnabled(event.value));
      }
      if (
        event.name === GLOBAL_SEARCH_ENABLED_STORAGE_KEY
        || event.name === NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY
        || event.name === STORAGE_KEY_PROVIDERS
        || event.name === TORRPLAY_ENABLED_STORAGE_KEY
      ) {
        this.syncGlobalSearchSource();
      }
    });
  }

  private static syncGlobalSearchSource(): void {
    if (!Lampa.Search || !Lampa.Storage) return;

    const isEnabled = Lampa.Storage.get(TORRPLAY_ENABLED_STORAGE_KEY, true);
    const hasProviders = ProviderManager.getEnabledProviders().length > 0;
    const isSearchEnabled = readTriggerSetting(GLOBAL_SEARCH_ENABLED_STORAGE_KEY);
    const shouldReplaceNativeSource = isEnabled && hasProviders;
    const shouldEnableNativeSearch = shouldReplaceNativeSource ? false : isSearchEnabled;

    this.isManagingNativeGlobalSearch = true;
    try {
      const nativeSearchEnabled = Boolean(Lampa.Storage.field(NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY));
      if (nativeSearchEnabled !== shouldEnableNativeSearch) {
        writeTriggerSetting(NATIVE_GLOBAL_SEARCH_ENABLED_STORAGE_KEY, shouldEnableNativeSearch);
      }
    } finally {
      this.isManagingNativeGlobalSearch = false;
    }

    if (shouldReplaceNativeSource && isSearchEnabled && !this.isGlobalSearchSourceActive) {
      this.globalSearchSource ||= this.createGlobalSearchSource();
      Lampa.Search.addSource(this.globalSearchSource);
      this.isGlobalSearchSourceActive = true;
    } else if ((!shouldReplaceNativeSource || !isSearchEnabled) && this.isGlobalSearchSourceActive) {
      if (this.globalSearchSource) Lampa.Search.removeSource(this.globalSearchSource);
      this.isGlobalSearchSourceActive = false;
    }
  }
}
