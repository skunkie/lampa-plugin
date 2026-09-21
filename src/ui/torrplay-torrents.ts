// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { resolveFileIndex, VIDEO_EXTENSIONS } from '../engine/file-parser';
import { isPersistedTorrent, SavedTorrents } from '../engine/saved-torrents';
import { TorrPlayEngine } from '../engine/torrplay-engine';
import { InstanceManager } from '../instances/instance-manager';
import { translate } from '../lang/translations';
import { Torrent, TorrentFile, TorrentStorage, TorrPlayInstance } from '../types/torrplay';
import { buildFileListItemElement } from './file-list-item';

export const TORRPLAY_TORRENTS_COMPONENT_ID = 'torrplay_torrents';

export const TORRPLAY_STORAGE_BADGE_ICON = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display: block;">
  <path d="M10 16h.01"/>
  <path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  <path d="M21.946 12.013H2.054"/>
  <path d="M6 16h.01"/>
</svg>
`.trim();

export const TORRPLAY_ACTIVE_BADGE = `
<div class="card__type card__type--active" data-testid="active-torrent-badge" title="Active" style="position: absolute; top: 0.5em; left: 0.5em; right: auto; z-index: 10; display: flex; align-items: center; justify-content: center; border-radius: 0.35em; background: rgba(0, 0, 0, 0.6); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); padding: 0.35em; color: #fff; pointer-events: none;"><span class="torrplay-active-dot"><span class="torrplay-active-dot__ping"></span><span class="torrplay-active-dot__core"></span></span></div>
`.trim();

export const TORRPLAY_STORAGE_BADGE = `
<div class="card__type card__type--storage" data-testid="file-storage-badge" title="File Storage" style="position: absolute; top: 0.5em; right: 0.5em; left: auto; z-index: 10; display: flex; align-items: center; justify-content: center; border-radius: 0.35em; background: rgba(0, 0, 0, 0.6); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); padding: 0.3em; color: #fff; pointer-events: none;">${TORRPLAY_STORAGE_BADGE_ICON}</div>
`.trim();

export function getNavigator(): LampaNavigator | null {
  const globalNavigator = (globalThis as typeof globalThis & { Navigator?: LampaNavigator }).Navigator;
  if (globalNavigator && typeof globalNavigator.move === 'function') {
    return globalNavigator;
  }
  if (typeof window !== 'undefined' && window.Navigator && typeof window.Navigator.move === 'function') {
    return window.Navigator;
  }
  if (typeof Lampa !== 'undefined' && Lampa.Navigator && typeof Lampa.Navigator.move === 'function') {
    return Lampa.Navigator;
  }
  return null;
}

export class TorrPlayTorrentsComponent {
  private static readonly POLL_INTERVAL_MS = 10_000;

  public componentActivity?: LampaComponentActivity;
  private activeInstance: TorrPlayInstance | null = null;
  private contentGrid: LampaDomElement;
  private contextMenuOpen = false;
  private contextMenuResumesPolling = false;
  private emptyState: LampaEmptyState | null = null;
  private fileListRequestId = 0;
  private isLoading = false;
  private lastFocusedElement: HTMLElement | null = null;
  private lastFocusedTorrentHash: string | null = null;
  private lastRenderedInstanceId: string | null = null;
  private lastRenderedSignature: string | null = null;
  private needsReload = false;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private rootElement: LampaDomElement;
  private scrollView: LampaScrollView;

  constructor(componentOptions?: LampaComponentOptions) {
    TorrPlayTorrentsComponent.injectStyles();
    this.componentActivity = componentOptions?.activity;
    this.scrollView = new Lampa.Scroll({
      mask: false,
      over: true,
      step: 250,
    });
    this.rootElement = $('<div class="torrplay-torrents"></div>');
    this.contentGrid = $('<div class="mapping--grid cols--6"></div>');
  }

  private updateHeaderTitle(instance: TorrPlayInstance | null): void {
    if (typeof Lampa === 'undefined' || !Lampa.Head || typeof Lampa.Head.title !== 'function') return;
    const instanceName = instance ? instance.name || instance.url : '';
    Lampa.Head.title(instanceName ? `TorrPlay (${instanceName})` : 'TorrPlay');
  }

  private static injectStyles(): void {
    if (typeof document === 'undefined') return;
    const styleId = 'torrplay-torrents-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .torrplay-torrents {
          height: 100%;
          width: 100%;
        }
        .torrplay-torrents--empty,
        .torrplay-torrents--empty .scroll {
          overflow: hidden !important;
        }
        .torrplay-torrents--empty .scroll > .scroll__content > .scroll__body:after {
          display: none !important;
        }
        .torrplay-torrents .torrplay-active-dot {
          display: flex;
          height: 0.5em;
          position: relative;
          width: 0.5em;
        }
        .torrplay-torrents .torrplay-active-dot__ping {
          animation: torrplay-active-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
          background: #4ade80;
          border-radius: 50%;
          display: inline-flex;
          height: 100%;
          opacity: 0.75;
          position: absolute;
          width: 100%;
        }
        .torrplay-torrents .torrplay-active-dot__core {
          background: #22c55e;
          border-radius: 50%;
          display: inline-flex;
          height: 100%;
          position: relative;
          width: 100%;
        }
        .no--animation .torrplay-torrents .torrplay-active-dot__ping {
          animation: none;
        }
        @keyframes torrplay-active-ping {
          75%, 100% {
            opacity: 0;
            transform: scale(2);
          }
        }
        .torrplay-torrents .empty {
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 auto !important;
          text-align: center !important;
          width: 100% !important;
        }
        .torrplay-torrents .empty__img {
          width: 100% !important;
        }
        .torrplay-torrents .empty__title {
          box-sizing: border-box !important;
          line-height: 1.4 !important;
          margin: 0 auto !important;
          max-width: 100% !important;
          text-align: center !important;
          width: 100% !important;
        }
        .torrplay-torrents .empty__descr {
          box-sizing: border-box !important;
          display: block !important;
          line-height: 1.6 !important;
          margin: 0.8em auto 0 !important;
          max-width: 48em !important;
          padding: 0 1em !important;
          text-align: center !important;
          width: 100% !important;
          word-break: break-word !important;
        }
        .torrplay-torrents .empty__footer {
          display: flex !important;
          justify-content: center !important;
          margin-top: 2em !important;
          width: 100% !important;
        }
      `;
      if (document.head) {
        document.head.appendChild(style);
      }
    }
  }

  public create(): LampaDomElement | HTMLElement {
    this.scrollView.minus();
    this.scrollView.append(this.contentGrid);
    this.rootElement.append(this.scrollView.render());
    this.load();
    return this.render();
  }

  public async load(silent = false): Promise<void> {
    if (this.isLoading) return;
    // Rebuilding the grid replaces every card element, which detaches the card the open context
    // menu acts on and the element focus is restored to when it closes. Skip background
    // refreshes until the menu is closed; polling resumes from there.
    if (silent && this.contextMenuOpen) return;
    this.isLoading = true;

    if (!silent && this.componentActivity) {
      this.componentActivity.loader(true);
    }

    try {
      this.activeInstance = await InstanceManager.getBestInstance();
      this.updateHeaderTitle(this.activeInstance);
      const [torrentsResponse, settings] = await Promise.all([
        TorrPlayApi.getTorrents(this.activeInstance),
        TorrPlayApi.getSettings(this.activeInstance).catch(() => null),
      ]);
      if (settings) {
        let changed = false;
        if (typeof settings.file_storage_path === 'string') {
          this.activeInstance.fileStoragePath = settings.file_storage_path;
          changed = true;
        }
        if (typeof settings.enable_downloader === 'boolean') {
          this.activeInstance.enableDownloader = settings.enable_downloader;
          changed = true;
        }
        if (changed) {
          InstanceManager.updateInstance(this.activeInstance);
        }
      }

      const torrents = torrentsResponse.torrents || [];
      SavedTorrents.syncFromListing(this.activeInstance.id, torrents);

      // The context menu may have opened while this request was in flight.
      if (silent && this.contextMenuOpen) {
        this.isLoading = false;
        return;
      }

      if (torrents.length === 0) {
        this.renderEmptyState(
          translate('torrplay_empty_db', 'No torrents found in TorrPlay database'),
          'TorrPlay',
          silent
        );
      } else {
        this.renderTorrents(torrents, this.activeInstance, silent);
      }
    } catch (err: unknown) {
      if (silent) {
        // A background refresh failure is likely transient (e.g. a brief network blip) — leave
        // whatever is currently rendered alone rather than replacing it with an error screen,
        // and let the next poll tick retry.
        this.isLoading = false;
        return;
      }

      this.updateHeaderTitle(null);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('unreachable') || errorMessage.includes('offline')) {
        this.renderEmptyState(
          translate(
            'torrplay_empty_unreachable',
            'All configured TorrPlay instances are unreachable.<br>Please check instance status in Settings → TorrPlay → Manage Instance Pool.'
          ),
          translate('torrplay_empty_unreachable_title', 'TorrPlay: Instances Unreachable'),
          silent
        );
      } else if (errorMessage.includes('No TorrPlay instances')) {
        this.renderEmptyState(
          translate(
            'torrplay_empty_no_instances',
            'No TorrPlay instances are configured.<br>Please add an instance in Settings → TorrPlay → Manage Instance Pool.'
          ),
          translate('torrplay_empty_no_instances_title', 'TorrPlay: No Instances Configured'),
          silent
        );
      } else {
        this.renderEmptyState(
          translate(
            'torrplay_empty_conn_error',
            `Unable to load database torrents: ${errorMessage}<br>Please check your instance connection.`,
            { msg: errorMessage }
          ),
          translate('torrplay_empty_conn_error_title', 'TorrPlay: Connection Error'),
          silent
        );
      }
    }

    this.isLoading = false;
    if (!silent && this.componentActivity) {
      this.componentActivity.loader(false);
      this.componentActivity.toggle();
    }
  }

  public start(): void {
    this.clearContextMenuState();
    if (this.needsReload) {
      this.needsReload = false;
      this.lastFocusedElement = null;
      this.load().finally(() => this.startPolling());
      return;
    }

    if (this.emptyState && typeof this.emptyState.start === 'function') {
      this.emptyState.start();
      this.startPolling();
      return;
    }

    Lampa.Controller.add('content', {
      back: () => {
        Lampa.Activity.backward();
      },
      down: () => {
        const navigator = getNavigator();
        if (navigator) {
          if (navigator.canmove ? navigator.canmove('down') : true) {
            navigator.move('down');
          }
        }
      },
      left: () => {
        const navigator = getNavigator();
        if (navigator && navigator.canmove && navigator.canmove('left')) {
          navigator.move('left');
        } else {
          Lampa.Controller.toggle('menu');
        }
      },
      right: () => {
        const navigator = getNavigator();
        if (navigator && navigator.move) {
          navigator.move('right');
        }
      },
      toggle: () => {
        // Recompute scroll layout here, not during silent background refreshes, since this
        // callback fires exactly when this component genuinely regains focus.
        this.scrollView.update(this.contentGrid, true);
        Lampa.Controller.collectionSet(this.scrollView.render(true));
        Lampa.Controller.collectionFocus(this.lastFocusedElement || false, this.scrollView.render(true));
        if (this.needsReload) {
          this.needsReload = false;
          this.load(true).finally(() => this.startPolling());
        }
      },
      up: () => {
        const navigator = getNavigator();
        if (navigator && navigator.canmove && navigator.canmove('up')) {
          navigator.move('up');
        } else {
          Lampa.Controller.toggle('head');
        }
      },
    });
    Lampa.Controller.toggle('content');
    this.startPolling();
  }

  public pause(): void {
    this.fileListRequestId++;
    this.clearContextMenuState();
    this.stopPolling();
    this.needsReload = true;
  }

  public stop(): void {
    this.fileListRequestId++;
    this.clearContextMenuState();
    this.stopPolling();
    this.needsReload = true;
  }

  /**
   * Drops the context menu bookkeeping so a menu left open across a lifecycle transition
   * cannot suspend background refreshes for good.
   */
  private clearContextMenuState(): void {
    this.contextMenuOpen = false;
    this.contextMenuResumesPolling = false;
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollIntervalId = setInterval(() => {
      this.load(true);
    }, TorrPlayTorrentsComponent.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  public render(shouldReturnDomElement?: boolean): LampaDomElement | HTMLElement {
    return shouldReturnDomElement ? this.rootElement[0] : this.rootElement;
  }

  /**
   * True when the D-pad cursor currently sits on one of this grid's own cards. Rebuilding the
   * grid detaches those cards, and the navigator steers by element geometry — a detached card
   * measures as a zero-sized rect, so every direction becomes unreachable and the grid's own
   * left/up handlers escape to the sidebar and the head instead of moving inside the grid.
   */
  private ownsNavigatorFocus(): boolean {
    const gridElement = this.contentGrid[0];
    if (!gridElement) return false;

    const navigator = getNavigator();
    if (navigator && typeof navigator.getFocusedElement === 'function') {
      const focusedElement = navigator.getFocusedElement();
      if (!focusedElement) return false;
      return typeof gridElement.contains === 'function' && gridElement.contains(focusedElement);
    }

    // Not every navigator build exposes the focused element, so fall back to the marker class
    // it puts on whatever currently holds the cursor.
    return typeof gridElement.querySelector === 'function' && !!gridElement.querySelector('.card.focus');
  }

  /**
   * Re-registers the rebuilt cards with the navigator and marks the replacement of the card
   * that held the cursor, without recomputing scroll layout or re-triggering hover:focus —
   * either of those would move the visible scroll position under the user.
   */
  private restoreNavigatorFocus(replacementCard: HTMLElement | false): void {
    const hasController = typeof Lampa !== 'undefined' && !!Lampa.Controller;
    if (hasController) {
      Lampa.Controller.collectionSet(this.scrollView.render(true));
    }

    const navigator = getNavigator();
    if (replacementCard && navigator && typeof navigator.focused === 'function') {
      navigator.focused(replacementCard);
      if (typeof $ === 'function') {
        $(replacementCard).addClass('focus');
      }
      return;
    }

    if (hasController) {
      Lampa.Controller.collectionFocus(replacementCard || false, this.scrollView.render(true));
    }
  }

  private static buildTorrentsSignature(torrents: Torrent[]): string {
    const viewedList: string[] = (typeof Lampa !== 'undefined' && Lampa.Storage?.get('torrents_view', [])) || [];
    return torrents
      .map(torrent => [
        torrent.hash,
        torrent.title || torrent.name || '',
        torrent.storage || '',
        torrent.active ? '1' : '0',
        torrent.poster || '',
        typeof torrent.data === 'string' ? torrent.data : '',
        torrent.magnet || '',
        String(torrent.total_size || torrent.totalSize || 0),
        String(torrent.files ? torrent.files.length : 0),
        viewedList.includes(torrent.hash) ? '1' : '0',
      ].join('\u0001'))
      .join('\u0002');
  }

  private static buildEmptyStateSignature(title: string, description: string): string {
    return ['\u0003empty', title, description].join('\u0001');
  }

  public renderEmptyState(description: string, title = 'TorrPlay', silent = false): void {
    const signature = TorrPlayTorrentsComponent.buildEmptyStateSignature(title, description);
    // The same empty state is already on screen, and a silent refresh never clears the scroll
    // view — rendering again would stack another copy of it on every poll tick.
    if (silent && signature === this.lastRenderedSignature) return;

    const ownedNavigatorFocus = silent && this.ownsNavigatorFocus();
    this.lastRenderedSignature = signature;
    this.lastRenderedInstanceId = null;
    if (typeof this.rootElement.addClass === 'function') {
      this.rootElement.addClass('torrplay-torrents--empty');
    }
    if (!silent) {
      if (typeof this.scrollView.clear === 'function') {
        this.scrollView.clear();
      }
      if (typeof this.scrollView.nopadding === 'function') {
        this.scrollView.nopadding();
      }
      if (typeof this.scrollView.reset === 'function') {
        this.scrollView.reset();
      }
    }
    this.contentGrid.empty();

    const emptyState = new Lampa.Empty({
      descr: description,
      title,
    });
    this.emptyState = emptyState;
    const emptyElement = emptyState.render();

    if (typeof this.scrollView.append === 'function') {
      this.scrollView.append(emptyElement);
    } else {
      this.contentGrid.append(emptyElement);
    }

    // See the matching note in renderTorrents — a silent background refresh must never touch
    // scroll layout or focus; the content controller's own toggle callback handles that when
    // this component genuinely regains control.
    if (!silent) {
      if (this.emptyState && typeof this.emptyState.start === 'function') {
        this.emptyState.start();
      } else if (typeof Lampa !== 'undefined' && Lampa.Controller) {
        Lampa.Controller.collectionSet(this.scrollView.render(true));
        Lampa.Controller.collectionFocus(false, this.scrollView.render(true));
      }
    } else if (ownedNavigatorFocus) {
      this.restoreNavigatorFocus(false);
    }
    if (typeof Lampa !== 'undefined' && Lampa.Layer && typeof Lampa.Layer.update === 'function') {
      Lampa.Layer.update();
    }
    if (!silent && this.componentActivity) {
      this.componentActivity.toggle();
    }
  }

  public renderTorrents(torrents: Torrent[], instance: TorrPlayInstance, silent = false): void {
    const signature = TorrPlayTorrentsComponent.buildTorrentsSignature(torrents);
    // Nothing on screen would change, so leave the live card elements in place rather than
    // detaching the one the navigator is steering by. The instance has to match too: the cards
    // close over it, so skipping a rebuild after a failover would leave every card acting on
    // the instance that was just replaced.
    if (silent && signature === this.lastRenderedSignature && instance.id === this.lastRenderedInstanceId) return;

    const ownedNavigatorFocus = silent && this.ownsNavigatorFocus();
    this.lastRenderedSignature = signature;
    this.lastRenderedInstanceId = instance.id;
    this.emptyState = null;
    if (typeof this.rootElement.removeClass === 'function') {
      this.rootElement.removeClass('torrplay-torrents--empty');
    }
    if (typeof this.scrollView.clear === 'function') {
      this.scrollView.clear();
    }
    const scrollRender = this.scrollView.render();
    if (scrollRender && typeof scrollRender.removeClass === 'function') {
      scrollRender.removeClass('scroll--nopadding');
    } else if (typeof $ !== 'undefined') {
      $(scrollRender).removeClass('scroll--nopadding');
    }

    this.contentGrid.empty();
    if (typeof this.contentGrid.addClass === 'function') {
      this.contentGrid.addClass('mapping--grid cols--6');
    }
    if (typeof this.scrollView.append === 'function') {
      this.scrollView.append(this.contentGrid);
    }
    if (typeof Lampa !== 'undefined' && Lampa.Layer && typeof Lampa.Layer.update === 'function') {
      Lampa.Layer.update();
    }

    let elementToFocus: HTMLElement | false = false;

    torrents.forEach(torrent => {
      const totalSizeBytes = torrent.total_size || torrent.totalSize || 0;
      const formattedSize = totalSizeBytes > 0 ? Lampa.Utils.bytesToSize(totalSizeBytes) : '';
      const fileCount = torrent.files ? torrent.files.length : 0;
      const formattedFileCount = `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`;
      const metadataLine = [formattedSize, formattedFileCount].filter(Boolean).join(' · ');
      const cardTitle = Lampa.Utils.clearHtmlTags(torrent.title || torrent.name || '');
      const isFileStorage = torrent.storage === 'file';
      const isActive = torrent.active === true;
      const viewedList: string[] = (typeof Lampa !== 'undefined' && Lampa.Storage?.get('torrents_view', [])) || [];
      const isViewed = viewedList.includes(torrent.hash);
      const viewedIconHtml = isViewed
        ? `<div class="card__icon card__icon--viewed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>`
        : '';

      // Match the card markup used by Lampa's current My Torrents grid.
      const card = $(`
        <div class="card card--loaded selector layer--visible layer--render">
          <div class="card__view">
            <img src="./img/img_load.svg" class="card__img" />
            <div class="card__icons">
              <div class="card__icons-inner">${viewedIconHtml}</div>
            </div>
            ${isActive ? TORRPLAY_ACTIVE_BADGE : ''}
            ${isFileStorage ? TORRPLAY_STORAGE_BADGE : ''}
          </div>
          <div class="card__title">${cardTitle}</div>
          <div class="card__age">${metadataLine}</div>
        </div>
      `);

      const posterImage = card.find('.card__img');

      if (torrent.poster) {
        const posterImageElement = posterImage[0] as HTMLImageElement;
        posterImageElement.onload = () => {
          card.addClass('card--loaded');
        };
        posterImageElement.onerror = () => {
          posterImageElement.src = './img/img_broken.svg';
          card.addClass('card--loaded');
        };
        posterImageElement.src = torrent.poster;
      } else {
        posterImage.attr('src', './img/img_broken.svg');
        card.addClass('card--loaded');
      }

      card.on('hover:focus', (event: LampaDomEvent) => {
        const targetElement = event.currentTarget || event.target;
        if (!targetElement) return;
        this.lastFocusedElement = targetElement;
        this.lastFocusedTorrentHash = torrent.hash;
        this.scrollView.update($(targetElement), true);
        if (torrent.poster) {
          Lampa.Background.change(torrent.poster);
        }
      });

      card.on('hover:hover hover:touch', (event: LampaDomEvent) => {
        const targetElement = event.currentTarget || event.target;
        if (!targetElement) return;
        this.lastFocusedElement = targetElement;
        this.lastFocusedTorrentHash = torrent.hash;
        const navigator = getNavigator();
        if (navigator && navigator.focused) {
          navigator.focused(targetElement);
        }
      });

      card.on('hover:enter', () => {
        this.openTorrentSafely(torrent);
      });

      card.on('hover:long', () => {
        this.openContextMenu(torrent, instance, card);
      });

      card.on('contextmenu', (event: LampaDomEvent) => {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        this.openContextMenu(torrent, instance, card);
      });

      if (this.lastFocusedTorrentHash && torrent.hash === this.lastFocusedTorrentHash) {
        elementToFocus = card[0];
        this.lastFocusedElement = card[0];
      }

      this.contentGrid.append(card);
    });

    const rebuiltFocusCard = elementToFocus;

    if (!elementToFocus && this.lastFocusedElement) {
      elementToFocus = this.lastFocusedElement;
    }

    // Rebuilding the scroll view's layout moves the on-screen scroll position, so a silent
    // background refresh must never touch it. The content controller's own toggle callback
    // recomputes layout and restores focus once this component genuinely regains control.
    if (!silent) {
      this.scrollView.update(this.contentGrid, true);
      if (typeof Lampa !== 'undefined' && Lampa.Controller) {
        Lampa.Controller.collectionSet(this.scrollView.render(true));
        Lampa.Controller.collectionFocus(elementToFocus || false, this.scrollView.render(true));
      }
    } else if (ownedNavigatorFocus) {
      this.restoreNavigatorFocus(rebuiltFocusCard);
    }
    if (!silent && this.componentActivity) {
      this.componentActivity.toggle();
    }
  }

  private resolveTorrentMovieContext(torrent: Torrent): LampaMovie | undefined {
    if (!torrent.data) return undefined;
    try {
      const parsed: unknown = typeof torrent.data === 'string' ? JSON.parse(torrent.data) : torrent.data;
      return TorrPlayEngine.resolveMovieContext(parsed);
    } catch {
      return undefined;
    }
  }

  private playTorrentFileSafely(
    torrent: Torrent,
    fileIndex: number,
    sourceInstance?: TorrPlayInstance,
    returnController?: string
  ): void {
    const resolvedReturnController = returnController || Lampa.Controller?.enabled?.().name || 'content';

    TorrPlayEngine.startTorrentPlayback(torrent, fileIndex, undefined, sourceInstance, resolvedReturnController).catch((err: unknown) => {
      console.error('[TorrPlay] Playback failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (typeof Lampa !== 'undefined') {
        if (Lampa.Loading) Lampa.Loading.stop();
        if (Lampa.Controller) Lampa.Controller.toggle(resolvedReturnController);
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_error', `TorrPlay: ${errorMessage}`, { msg: errorMessage })
          );
        }
      }
    });
  }

  private openTorrentSafely(torrent: Torrent): void {
    void this.openTorrent(torrent).catch((err: unknown) => {
      console.error('[TorrPlay] Failed to open torrent:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (Lampa.Noty) {
        Lampa.Noty.show(
          translate('torrplay_noty_error', `TorrPlay: ${errorMessage}`, { msg: errorMessage })
        );
      }
    });
  }

  public async openTorrent(torrent: Torrent): Promise<void> {
    const fileListRequestId = ++this.fileListRequestId;
    const sourceInstance = this.activeInstance || undefined;
    const torrentFiles = torrent.files || [];
    const videoFiles = torrentFiles.filter((file: TorrentFile) => {
      const extension = (file.name || file.path || '').split('.').pop()?.toLowerCase();
      return VIDEO_EXTENSIONS.includes(extension || '');
    });

    if (torrentFiles.length > 0 && videoFiles.length === 0) {
      if (Lampa.Noty) {
        Lampa.Noty.show(translate('torrplay_noty_no_video', 'No video files found in torrent'));
      }
      return;
    }

    const sortedFiles = TorrPlayEngine.sortTorrentFiles(videoFiles);

    if (sortedFiles.length <= 1) {
      const singleFileIndex = sortedFiles.length > 0
        ? resolveFileIndex(torrentFiles, sortedFiles[0])
        : -1;
      this.playTorrentFileSafely(torrent, Math.max(singleFileIndex, 0), sourceInstance);
      return;
    }

    const movieContext = this.resolveTorrentMovieContext(torrent) || TorrPlayEngine.resolveMovieContext({
      original_name: torrent.name,
      original_title: torrent.name,
      title: torrent.title || torrent.name,
    });
    const fileInfos = sortedFiles.map(file => TorrPlayEngine.resolveFileInfo(file, movieContext, torrent.hash, sortedFiles));

    // Matches Lampa's native torrent file list: fetch TMDB episode metadata up
    // front so multi-episode entries can render with a still image, episode
    // name, and air date instead of the plain title-only row.
    const seasonsData = await TorrPlayEngine.fetchSeasonEpisodes(movieContext, TorrPlayEngine.collectSeasonNumbers(fileInfos));
    if (fileListRequestId !== this.fileListRequestId) return;

    const fallbackImage = TorrPlayEngine.resolvePosterUrl(torrent, movieContext);

    const fileListElement = $('<div class="torrent-files"></div>');
    const returnController = Lampa.Controller?.enabled?.().name || 'content';
    const title = typeof Lampa !== 'undefined' && Lampa.Lang?.translate
      ? Lampa.Lang.translate('title_files')
      : 'Files';

    const openFileListModal = (): void => {
      Lampa.Modal.open({
        html: fileListElement,
        mask: true,
        onBack: () => {
          Lampa.Modal.close();
          Lampa.Controller.toggle(returnController);
        },
        size: 'large',
        title,
      });
      // Modal.open updates lazy row visibility after its initial focus attempt.
      Lampa.Controller?.collectionFocus?.(false, fileListElement);
    };

    sortedFiles.forEach((file: TorrentFile, fallbackIndex: number) => {
      const resolvedFileIndex = resolveFileIndex(torrentFiles, file);
      const fileIndex = resolvedFileIndex >= 0 ? resolvedFileIndex : fallbackIndex;
      const fullName = file.name || file.path || '';
      const extensionPosition = fullName.lastIndexOf('.');
      const title = Lampa.Utils.clearHtmlTags(
        extensionPosition > 0 ? fullName.slice(0, extensionPosition) : fullName
      );
      const extension = extensionPosition > 0 ? fullName.slice(extensionPosition + 1) : '';
      const formattedSize = file.length > 0 ? Lampa.Utils.bytesToSize(file.length) : '';
      const fileInfo = fileInfos[fallbackIndex];
      const preview = TorrPlayEngine.resolveEpisodePreview(fileInfo, seasonsData, fallbackImage);
      const timeline = Lampa.Timeline ? Lampa.Timeline.view(fileInfo.hash) : undefined;

      const fileItemElement = buildFileListItemElement({
        exe: extension,
        fileInfo,
        preview,
        size: formattedSize,
        timeline,
        title,
      });

      fileItemElement.on('hover:enter', () => {
        // Deliberately do not close the modal here: Lampa's own native torrent
        // file list leaves its modal open underneath the player and refocuses
        // it on exit via Controller.toggle('modal') instead of recreating it.
        this.playTorrentFileSafely(torrent, fileIndex, sourceInstance, 'modal');
      });

      fileListElement.append(fileItemElement);
    });

    openFileListModal();
  }

  public async openContextMenu(torrent: Torrent, instance: TorrPlayInstance, cardElement: LampaDomElement): Promise<void> {
    // A card binds this to both a long press and a context menu event, so a single gesture can
    // enter here twice. Only the first entry sees the real polling state; a later one would
    // record a stopped poller and leave refreshes suspended after the menu closes.
    if (!this.contextMenuOpen) {
      // Only a component that was polling before the menu opened should poll again after it closes.
      this.contextMenuResumesPolling = this.pollIntervalId !== null;
    }
    this.contextMenuOpen = true;
    this.stopPolling();

    if (instance && (typeof instance.fileStoragePath !== 'string' || typeof instance.enableDownloader !== 'boolean')) {
      try {
        const instanceSettings = await TorrPlayApi.getSettings(instance);
        if (instanceSettings) {
          let changed = false;
          if (typeof instanceSettings.file_storage_path === 'string') {
            instance.fileStoragePath = instanceSettings.file_storage_path;
            changed = true;
          }
          if (typeof instanceSettings.enable_downloader === 'boolean') {
            instance.enableDownloader = instanceSettings.enable_downloader;
            changed = true;
          }
          if (changed) {
            InstanceManager.updateInstance(instance);
          }
        }
      } catch {} // Best-effort settings prefetch — failure is non-fatal; context menu opens with defaults.
    }

    const rawStoragePath = instance && typeof instance.fileStoragePath === 'string' ? instance.fileStoragePath : '';
    const fileStoragePath = String(rawStoragePath).trim();
    const isFileStorageConfigured = fileStoragePath.length > 0;
    const hasKnownStorage = torrent.storage === 'memory' || torrent.storage === 'file';
    // The listing also covers torrents merely loaded in the torrent client. Those have no
    // database row for the server to patch, so a storage switch would only fail on them.
    const isPersisted = isPersistedTorrent(torrent);

    const items: Array<{ action: string, subtitle?: string, title: string }> = [];

    const movieData = this.resolveTorrentMovieContext(torrent);

    if (movieData) {
      items.push({
        action: 'card',
        subtitle: translate('torrplay_menu_card_descr', 'Open movie card details'),
        title: typeof Lampa !== 'undefined' && Lampa.Lang?.translate ? Lampa.Lang.translate('title_card') : 'Card details',
      });
    }

    const viewedList: string[] = (typeof Lampa !== 'undefined' && Lampa.Storage?.get('torrents_view', [])) || [];
    const isViewed = viewedList.includes(torrent.hash);

    items.push({
      action: isViewed ? 'unmark' : 'mark',
      subtitle: isViewed
        ? (typeof Lampa !== 'undefined' && Lampa.Lang?.translate ? Lampa.Lang.translate('torrent_parser_label_cancel_descr') : 'Remove view label')
        : (typeof Lampa !== 'undefined' && Lampa.Lang?.translate ? Lampa.Lang.translate('torrent_parser_label_descr') : 'Mark torrent as viewed'),
      title: isViewed
        ? (typeof Lampa !== 'undefined' && Lampa.Lang?.translate ? Lampa.Lang.translate('torrent_parser_label_cancel_title') : 'Remove label')
        : (typeof Lampa !== 'undefined' && Lampa.Lang?.translate ? Lampa.Lang.translate('torrent_parser_label_title') : 'Label'),
    });

    if (isPersisted && hasKnownStorage && isFileStorageConfigured) {
      const isFile = torrent.storage === 'file';
      items.push({
        action: 'switch-storage',
        subtitle: isFile
          ? translate('torrplay_menu_switch_ram_descr', 'Currently stored on disk')
          : translate('torrplay_menu_switch_disk_descr', 'Currently cached in RAM'),
        title: isFile
          ? translate('torrplay_menu_switch_ram', 'Switch to RAM')
          : translate('torrplay_menu_switch_disk', 'Switch to Disk'),
      });
    }

    items.push({
      action: 'delete',
      subtitle: translate('torrplay_menu_delete_descr', 'Remove torrent and cached data'),
      title: translate('torrplay_menu_delete', 'Delete from TorrPlay'),
    });

    const menuTitle = typeof Lampa !== 'undefined' && Lampa.Lang?.translate
      ? Lampa.Lang.translate('title_action')
      : 'Action';

    Lampa.Select.show({
      items,
      onBack: () => {
        this.returnToContent();
      },
      onSelect: async (selectedItem: LampaSelectItem) => {
        this.contextMenuOpen = false;

        if (selectedItem.action === 'card') {
          // Pushing an activity navigates away; the component's own pause/stop hooks
          // take over polling from here.
          this.contextMenuResumesPolling = false;
          if (typeof Lampa !== 'undefined' && Lampa.Activity && movieData) {
            Lampa.Activity.push({
              card: movieData,
              component: 'full',
              id: movieData.id,
              method: movieData.name ? 'tv' : 'movie',
              source: movieData.source || 'tmdb',
            });
          }
        } else if (selectedItem.action === 'mark') {
          const currentViewed: string[] = (typeof Lampa !== 'undefined' && Lampa.Storage?.get('torrents_view', [])) || [];
          if (!currentViewed.includes(torrent.hash)) {
            currentViewed.push(torrent.hash);
            Lampa.Storage.set('torrents_view', currentViewed);
          }
          if (cardElement && typeof cardElement.find === 'function') {
            const iconsInner = cardElement.find('.card__icons-inner');
            if (iconsInner.length && iconsInner.find('.card__icon--viewed').length === 0) {
              iconsInner.append(`
                <div class="card__icon card__icon--viewed">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
              `);
            }
          }
          this.returnToContent();
        } else if (selectedItem.action === 'unmark') {
          const currentViewed: string[] = (typeof Lampa !== 'undefined' && Lampa.Storage?.get('torrents_view', [])) || [];
          const updatedViewed = currentViewed.filter(h => h !== torrent.hash);
          Lampa.Storage.set('torrents_view', updatedViewed);
          if (cardElement && typeof cardElement.find === 'function') {
            cardElement.find('.card__icon--viewed').remove();
          }
          this.returnToContent();
        } else if (selectedItem.action === 'switch-storage') {
          const nextStorage: TorrentStorage = torrent.storage === 'memory' ? 'file' : 'memory';
          try {
            await TorrPlayApi.updateTorrent(instance, torrent.hash, { storage: nextStorage });
            torrent.storage = nextStorage;
            if (cardElement && typeof cardElement.find === 'function') {
              if (nextStorage === 'file') {
                const cardType = cardElement.find('.card__type');
                if (!cardType || cardType.length === 0) {
                  const cardView = cardElement.find('.card__view');
                  if (cardView && typeof cardView.append === 'function') {
                    cardView.append(TORRPLAY_STORAGE_BADGE);
                  }
                }
              } else {
                const cardType = cardElement.find('.card__type');
                if (cardType && typeof cardType.remove === 'function') {
                  cardType.remove();
                }
              }
            }
            const storageLabel = nextStorage === 'file'
              ? translate('torrplay_storage_type_disk', 'Disk')
              : translate('torrplay_storage_type_ram', 'RAM');
            Lampa.Noty.show(translate('torrplay_noty_storage_switched', `Storage switched to ${storageLabel}`, { storage: storageLabel }));
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Lampa.Noty.show(translate('torrplay_noty_storage_switch_failed', `Failed to switch storage: ${errorMessage}`, { msg: errorMessage }));
          }
          this.returnToContent();
        } else if (selectedItem.action === 'delete') {
          try {
            await TorrPlayApi.deleteTorrent(instance, torrent.hash);
            SavedTorrents.markUnsaved(torrent.hash, instance.id);
            if (cardElement && typeof cardElement.remove === 'function') {
              cardElement.remove();
            }
            Lampa.Noty.show(translate('torrplay_noty_deleted_from_tp', 'Torrent deleted from TorrPlay'));
            if (this.contentGrid.find('.card').length === 0) {
              this.renderEmptyState(translate('torrplay_empty_db', 'No torrents found in TorrPlay database'));
            }
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Lampa.Noty.show(translate('torrplay_noty_delete_failed', `Failed to delete: ${errorMessage}`, { msg: errorMessage }));
          }
          this.returnToContent();
        }
      },
      title: menuTitle,
    });
  }

  /**
   * Hands focus back to the torrent grid after a context menu closes and resumes polling.
   */
  private returnToContent(): void {
    const shouldResumePolling = this.contextMenuResumesPolling;
    this.clearContextMenuState();
    if (typeof Lampa !== 'undefined' && Lampa.Controller) {
      Lampa.Controller.toggle('content');
    }
    if (shouldResumePolling) {
      this.startPolling();
    }
  }

  public destroy(): void {
    this.fileListRequestId++;
    this.clearContextMenuState();
    this.stopPolling();
    if (this.emptyState && typeof this.emptyState.destroy === 'function') {
      this.emptyState.destroy();
    }
    this.scrollView.destroy();
    this.rootElement.remove();
  }
}
