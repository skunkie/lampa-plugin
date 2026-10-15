// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { isNetworkError } from '../api/http-client';
import { TorrPlayApi, TorrPlayApiError } from '../api/torrplay';
import { DATABASE_SEARCH_ENABLED_STORAGE_KEY, searchDatabaseTorrents } from '../engine/database-search';
import { isTorrentViewed, setTorrentViewed } from '../engine/engine-utils';
import { resolveFileIndex, selectVideoFiles } from '../engine/file-parser';
import { TorrPlayEngine } from '../engine/torrplay-engine';
import { InstanceManager } from '../instances/instance-manager';
import { translate } from '../lang/translations';
import { Torrent } from '../types/torrplay';
import { decodeSearchQuery } from '../utils/search-query';
import { readTriggerSetting } from '../utils/trigger-setting';
import { generateUuid } from '../utils/uuid';
import {
  buildSavedTorrentCard,
  describeViewedAction,
  SavedTorrentSummary,
  setSavedTorrentCardViewed,
  summarizeSavedTorrent,
  WatchedOverlayScheduler,
} from './saved-torrent-card';
import { showSavedTorrentFiles } from './saved-torrent-files';
import { TORRPLAY_ENABLED_STORAGE_KEY } from './settings';
import { TORRPLAY_TORRENTS_COMPONENT_ID } from './torrplay-torrents';

// Lampa offers a row's "More" view once its results span more than one page of this size.
const RESULTS_PER_PAGE = 20;

interface DatabaseSearchItem {
  databaseScopeId: string,
  instanceId: string,
  params?: { createInstance: (item: DatabaseSearchItem) => SavedTorrentSearchCard },
  torrent: SavedTorrentSummary,
  torrentHash: string
}

interface DatabaseSearchRow {
  instanceId: string,
  query: string,
  results: DatabaseSearchItem[],
  title: string,
  total: number,
  total_pages: number
}

/** The tab list of an open global search, as its `sources` event hands it over. */
interface GlobalSearchTabs {
  enable(result: unknown): void,
  listener: { follow(event: 'create', callback: (created: { result: unknown, source: unknown }) => void): void },
  tabs(): HTMLElement
}

interface DatabaseSearchSource {
  onCancel: () => void,
  onMore: (params: { data: DatabaseSearchRow, query?: string }, close: () => void) => void,
  onRecall: (rows: DatabaseSearchRow[]) => void,
  onSelect: (params: { element: DatabaseSearchItem, line: { toggle: () => void } }) => void,
  params: { lazy: boolean },
  search: (params: { query: string }, onComplete: (rows: DatabaseSearchRow[]) => void) => void,
  title: string
}

/**
 * A saved torrent's card in the global search row: the same card as the TorrPlay library,
 * playing through the row's own selection and offering only the viewed mark on long press,
 * since storage switching and deletion belong to the library view.
 */
class SavedTorrentSearchCard {
  private card: LampaDomElement | null = null;
  private onEnter: (() => void) | null = null;
  private readonly watchedOverlay = new WatchedOverlayScheduler();

  public constructor(private readonly item: DatabaseSearchItem) {}

  public use(handlers: { onEnter?: () => void }): void {
    if (handlers.onEnter) this.onEnter = handlers.onEnter;
  }

  public create(): void {
    const { torrent } = this.item;
    const card = buildSavedTorrentCard(torrent, isTorrentViewed(torrent.hash));
    card.on('hover:enter', () => this.onEnter?.());
    card.on('hover:focus', () => this.watchedOverlay.schedule(card, torrent));
    card.on('hover:long', () => this.showViewedAction());
    this.card = card;
  }

  public render(asElement?: boolean): HTMLElement | LampaDomElement | undefined {
    return asElement ? this.card?.[0] : this.card || undefined;
  }

  public destroy(): void {
    this.watchedOverlay.cancel();
    this.card?.remove();
    this.card = null;
  }

  private showViewedAction(): void {
    const card = this.card;
    if (!card) return;
    const { hash } = this.item.torrent;
    const returnController = Lampa.Controller.enabled?.()?.name || 'items_line';
    Lampa.Select.show({
      items: [describeViewedAction(isTorrentViewed(hash))],
      onBack: () => Lampa.Controller.toggle(returnController),
      onSelect: (selectedItem: LampaSelectItem & { action?: string }) => {
        const isViewed = selectedItem.action === 'mark';
        setTorrentViewed(hash, isViewed);
        setSavedTorrentCardViewed(card, isViewed);
        Lampa.Controller.toggle(returnController);
      },
      title: Lampa.Lang?.translate ? Lampa.Lang.translate('title_action') : 'Action',
    });
  }
}

export class DatabaseSearch {
  private static cancelSearch: (() => void) | null = null;
  private static databaseScopeId = '';
  private static isRegistered = false;
  private static isSourceActive = false;
  private static playbackRequestId = 0;
  private static source: DatabaseSearchSource | null = null;

  public static init(): void {
    if (this.isRegistered || typeof Lampa === 'undefined' || !Lampa.Search || !Lampa.Storage) return;
    this.isRegistered = true;
    this.databaseScopeId = generateUuid();
    this.syncSource();
    Lampa.Storage.listener?.follow('change', event => {
      if (event.name === DATABASE_SEARCH_ENABLED_STORAGE_KEY || event.name === TORRPLAY_ENABLED_STORAGE_KEY) {
        this.syncSource();
      }
    });
    InstanceManager.onSelectionChanged(() => this.invalidateDatabaseScope());
    this.followSearchOpening();
  }

  /**
   * Opens global search on this source's tab when it is opened from the TorrPlay library, since
   * a search started there is most likely after a saved torrent. Lampa builds the tabs between
   * its `sources` and `open` events and selects the first one itself, so the tab is noted as it
   * is built and selected once the search is open.
   */
  private static followSearchOpening(): void {
    let pendingTab: { result: unknown, tabIndex: number, tabs: GlobalSearchTabs } | null = null;

    Lampa.Search?.listener?.follow('sources', (event: { sources?: GlobalSearchTabs }) => {
      pendingTab = null;
      const tabs = event?.sources;
      const isFromLibrary = Lampa.Activity?.active?.()?.component === TORRPLAY_TORRENTS_COMPONENT_ID;
      if (!tabs?.listener || !this.isSourceActive || !isFromLibrary) return;
      let tabIndex = 0;
      tabs.listener.follow('create', (created: { result: unknown, source: unknown }) => {
        if (created.source === this.source) pendingTab = { result: created.result, tabIndex, tabs };
        tabIndex++;
      });
    });

    Lampa.Search?.listener?.follow('open', () => {
      const tab = pendingTab;
      pendingTab = null;
      if (!tab) return;
      tab.tabs.enable(tab.result);
      // A tab remembers itself as the one to focus when it receives focus, so moving down from
      // the keyboard lands on it rather than on the first tab.
      tab.tabs.tabs().querySelectorAll('.search-source')[tab.tabIndex]?.dispatchEvent(new Event('hover:focus'));
    });
  }

  private static invalidateDatabaseScope(): void {
    this.databaseScopeId = generateUuid();
    this.playbackRequestId++;
    this.cancelSearch?.();
  }

  private static addCardFactory(item: DatabaseSearchItem): void {
    item.params = { createInstance: candidate => new SavedTorrentSearchCard(candidate) };
  }

  private static isEnabled(): boolean {
    return Boolean(Lampa.Storage.get(TORRPLAY_ENABLED_STORAGE_KEY, true))
      && readTriggerSetting(DATABASE_SEARCH_ENABLED_STORAGE_KEY);
  }

  private static syncSource(): void {
    if (this.isEnabled() && !this.isSourceActive) {
      this.source ||= this.createSource();
      Lampa.Search?.addSource(this.source);
      this.isSourceActive = true;
    } else if (!this.isEnabled() && this.isSourceActive) {
      this.invalidateDatabaseScope();
      Lampa.Search?.removeSource(this.source);
      this.isSourceActive = false;
    }
  }

  private static createSource(): DatabaseSearchSource {
    const title = translate('torrplay_database_search_title', 'TorrPlay Database');
    return {
      onCancel: () => {
        this.playbackRequestId++;
        this.cancelSearch?.();
      },
      onMore: (params, close) => {
        close();
        Lampa.Activity.push({
          component: TORRPLAY_TORRENTS_COMPONENT_ID,
          instanceId: params.data.instanceId,
          search: params.data.query,
          title,
          url: '',
        });
      },
      onRecall: rows => {
        // Rows may come from a failover instance rather than the preferred one; any instance still
        // in the pool can serve them, since playback goes back to the instance that listed them.
        const instanceIds = new Set(InstanceManager.getInstances().map(instance => instance.id));
        rows.forEach(row => {
          row.results = this.isEnabled()
            ? row.results.filter(item => item.databaseScopeId === this.databaseScopeId && instanceIds.has(item.instanceId))
            : [];
          row.results.forEach(item => this.addCardFactory(item));
        });
        const populatedRows = rows.filter(row => row.results.length > 0);
        rows.splice(0, rows.length, ...populatedRows);
      },
      onSelect: params => {
        const returnController = Lampa.Controller?.enabled?.().name || 'search';
        const restoreFocus = () => {
          Lampa.Controller?.toggle(returnController);
          params.line.toggle();
        };
        this.openTorrent(params.element, returnController, restoreFocus).catch(error => {
          restoreFocus();
          Lampa.Noty?.show(translate('torrplay_noty_error', 'TorrPlay: {msg}', {
            msg: error instanceof Error ? error.message : String(error),
          }));
        });
      },
      // Searched with every query rather than only once the tab is opened, so the tab can show
      // how many saved torrents match.
      params: { lazy: false },
      search: (params, onComplete) => {
        this.cancelSearch?.();
        let isSettled = false;
        const complete = (rows: DatabaseSearchRow[]) => {
          if (isSettled) return;
          isSettled = true;
          if (this.cancelSearch === cancel) this.cancelSearch = null;
          onComplete(rows);
        };
        const cancel = () => complete([]);
        this.cancelSearch = cancel;
        if (!this.isEnabled()) {
          cancel();
          return;
        }
        const query = decodeSearchQuery(params.query);
        InstanceManager.getBestKnownInstance().then(async instance => {
          if (isSettled) return;
          let activeInstance = instance;
          const torrents = await searchDatabaseTorrents(instance, query).catch(async error => {
            const isServerError = error instanceof TorrPlayApiError && error.status >= 500;
            if (isSettled || (!isServerError && !isNetworkError(error))) throw error;
            const fallbackInstance = await InstanceManager.failover(instance, () => isSettled);
            if (isSettled || !fallbackInstance) throw error;
            activeInstance = fallbackInstance;
            return searchDatabaseTorrents(fallbackInstance, query);
          });
          if (isSettled) return;
          // The whole match list goes in the row: Lampa counts a tab's results by the items it is
          // handed, and draws the row's cards progressively as it is scrolled.
          const results: DatabaseSearchItem[] = torrents.map(torrent => ({
            databaseScopeId: this.databaseScopeId,
            instanceId: activeInstance.id,
            torrent: summarizeSavedTorrent(torrent),
            torrentHash: torrent.hash,
          }));
          results.forEach(item => this.addCardFactory(item));
          complete(results.length ? [{
            instanceId: activeInstance.id,
            query,
            results,
            title,
            total: torrents.length,
            total_pages: Math.ceil(torrents.length / RESULTS_PER_PAGE),
          }] : []);
        }).catch(() => cancel());
      },
      title,
    };
  }

  private static async openTorrent(item: DatabaseSearchItem, returnController: string, restoreFocus: () => void): Promise<void> {
    if (!this.isEnabled() || item.databaseScopeId !== this.databaseScopeId) return;
    const playbackRequestId = ++this.playbackRequestId;
    const instance = InstanceManager.getInstances().find(candidate => candidate.id === item.instanceId);
    if (!instance) return;
    let torrent: Torrent;
    try {
      torrent = await TorrPlayApi.getTorrent(instance, item.torrentHash);
    } catch (error) {
      if (playbackRequestId !== this.playbackRequestId) return;
      throw error;
    }
    if (playbackRequestId !== this.playbackRequestId || item.databaseScopeId !== this.databaseScopeId) return;
    const torrentFiles = torrent.files || [];
    const files = selectVideoFiles(torrentFiles);
    const playFile = (fileIndex: number, playbackReturnController: string, restorePlaybackFocus: () => void) => {
      if (!this.isEnabled() || item.databaseScopeId !== this.databaseScopeId) return;
      void this.playFile(torrent, fileIndex, item.instanceId, playbackReturnController).then(isHandedOff => {
        if (isHandedOff) Lampa.Player.callback(restorePlaybackFocus);
        else restorePlaybackFocus();
      }).catch(error => {
        restorePlaybackFocus();
        Lampa.Noty?.show(translate('torrplay_noty_error', 'TorrPlay: {msg}', {
          msg: error instanceof Error ? error.message : String(error),
        }));
      });
    };
    if (files.length <= 1) {
      playFile(files[0] ? resolveFileIndex(torrentFiles, files[0]) : 0, returnController, restoreFocus);
      return;
    }
    await showSavedTorrentFiles({
      isStale: () => playbackRequestId !== this.playbackRequestId || item.databaseScopeId !== this.databaseScopeId,
      onBack: () => {
        Lampa.Modal.close();
        restoreFocus();
      },
      // The list stays open under the player, which hands focus back to it on exit.
      onSelect: fileIndex => playFile(fileIndex, 'modal', () => Lampa.Controller.toggle('modal')),
      torrent,
      videoFiles: files,
    });
  }

  private static async playFile(torrent: Torrent, fileIndex: number, instanceId: string, returnController: string): Promise<boolean> {
    const instance = InstanceManager.getInstances().find(candidate => candidate.id === instanceId);
    if (!instance) return false;
    return TorrPlayEngine.startTorrentPlayback(torrent, fileIndex, undefined, instance, returnController);
  }
}
