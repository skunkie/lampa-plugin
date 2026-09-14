// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { TorrPlayEngine } from '../engine/torrplay-engine';
import { InstanceManager } from '../instances/instance-manager';
import { translate } from '../lang/translations';
import { Torrent, TorrentFile, TorrentStorage, TorrPlayInstance } from '../types/torrplay';

export const TORRPLAY_TORRENTS_COMPONENT_ID = 'torrplay_torrents';

export const TORRPLAY_STORAGE_BADGE_ICON = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display: block;">
  <path d="M10 16h.01"/>
  <path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  <path d="M21.946 12.013H2.054"/>
  <path d="M6 16h.01"/>
</svg>
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
  private emptyState: LampaEmptyState | null = null;
  private isLoading = false;
  private lastFocusedElement: HTMLElement | null = null;
  private lastFocusedTorrentHash: string | null = null;
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
    this.stopPolling();
    this.needsReload = true;
  }

  public stop(): void {
    this.stopPolling();
    this.needsReload = true;
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

  public renderEmptyState(description: string, title = 'TorrPlay', silent = false): void {
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
    }
    if (typeof Lampa !== 'undefined' && Lampa.Layer && typeof Lampa.Layer.update === 'function') {
      Lampa.Layer.update();
    }
    if (!silent && this.componentActivity) {
      this.componentActivity.toggle();
    }
  }

  public renderTorrents(torrents: Torrent[], instance: TorrPlayInstance, silent = false): void {
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
        this.openTorrent(torrent);
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
    }
    if (!silent && this.componentActivity) {
      this.componentActivity.toggle();
    }
  }

  private playTorrentFileSafely(
    torrent: Torrent,
    fileIndex: number,
    sourceInstance?: TorrPlayInstance
  ): void {
    const returnController = Lampa.Controller?.enabled?.().name || 'content';

    TorrPlayEngine.startTorrentPlayback(torrent, fileIndex, undefined, sourceInstance).catch((err: unknown) => {
      console.error('[TorrPlay] Playback failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (typeof Lampa !== 'undefined') {
        if (Lampa.Loading) Lampa.Loading.stop();
        if (Lampa.Controller) Lampa.Controller.toggle(returnController);
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_error', `TorrPlay: ${errorMessage}`, { msg: errorMessage })
          );
        }
      }
    });
  }

  public openTorrent(torrent: Torrent): void {
    const sourceInstance = this.activeInstance || undefined;
    const videoFiles = (torrent.files || []).filter((file: TorrentFile) => {
      const extension = (file.name || file.path || '').split('.').pop()?.toLowerCase();
      return ['mp4', 'mkv', 'avi', 'mov', 'webm', 'ts', 'm2ts'].includes(extension || '');
    });

    const playableFiles = videoFiles.length > 0 ? videoFiles : torrent.files || [];
    const sortedFiles = TorrPlayEngine.sortTorrentFiles(playableFiles);

    if (sortedFiles.length <= 1) {
      this.playTorrentFileSafely(torrent, sortedFiles[0]?.index ?? 0, sourceInstance);
      return;
    }

    const fileListElement = $('<div class="torrent-files"></div>');
    const returnController = Lampa.Controller?.enabled?.().name || 'content';

    sortedFiles.forEach((file: TorrentFile, fallbackIndex: number) => {
      const fileIndex = file.index !== undefined ? file.index : fallbackIndex;
      const fullName = file.name || file.path || '';
      const extensionPosition = fullName.lastIndexOf('.');
      const title = Lampa.Utils.clearHtmlTags(
        extensionPosition > 0 ? fullName.slice(0, extensionPosition) : fullName
      );
      const extension = extensionPosition > 0 ? fullName.slice(extensionPosition + 1) : '';
      const formattedSize = file.length > 0 ? Lampa.Utils.bytesToSize(file.length) : '';

      const fileItemElement = Lampa.Template.get('torrent_file', {
        exe: extension,
        size: formattedSize,
        title,
      });

      if (Lampa.Timeline) {
        const movieContext = TorrPlayEngine.resolveMovieContext({
          original_name: torrent.name,
          original_title: torrent.name,
          title: torrent.title || torrent.name,
        });
        const fileInfo = TorrPlayEngine.resolveFileInfo(file, movieContext, torrent.hash, sortedFiles);
        const timeline = Lampa.Timeline.view(fileInfo.hash);
        fileItemElement.append(Lampa.Timeline.render(timeline));
      }

      fileItemElement.on('hover:enter', () => {
        Lampa.Modal.close();
        Lampa.Controller.toggle(returnController);
        this.playTorrentFileSafely(torrent, fileIndex, sourceInstance);
      });

      fileListElement.append(fileItemElement);
    });

    const title = typeof Lampa !== 'undefined' && Lampa.Lang?.translate
      ? Lampa.Lang.translate('title_files')
      : 'Files';

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
  }

  public async openContextMenu(torrent: Torrent, instance: TorrPlayInstance, cardElement: LampaDomElement): Promise<void> {
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

    const items: Array<{ action: string, subtitle?: string, title: string }> = [];

    let movieData: LampaMovie | null = null;
    if (torrent.data) {
      try {
        const parsed: unknown = typeof torrent.data === 'string' ? JSON.parse(torrent.data) : torrent.data;
        movieData = TorrPlayEngine.resolveMovieContext(parsed) || null;
      } catch {}
    }

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

    if (hasKnownStorage && isFileStorageConfigured) {
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
        if (typeof Lampa !== 'undefined' && Lampa.Controller) {
          Lampa.Controller.toggle('content');
        }
      },
      onSelect: async (selectedItem: LampaSelectItem) => {
        if (selectedItem.action === 'card') {
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
          if (typeof Lampa !== 'undefined' && Lampa.Controller) {
            Lampa.Controller.toggle('content');
          }
        } else if (selectedItem.action === 'unmark') {
          const currentViewed: string[] = (typeof Lampa !== 'undefined' && Lampa.Storage?.get('torrents_view', [])) || [];
          const updatedViewed = currentViewed.filter(h => h !== torrent.hash);
          Lampa.Storage.set('torrents_view', updatedViewed);
          if (cardElement && typeof cardElement.find === 'function') {
            cardElement.find('.card__icon--viewed').remove();
          }
          if (typeof Lampa !== 'undefined' && Lampa.Controller) {
            Lampa.Controller.toggle('content');
          }
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
          if (typeof Lampa !== 'undefined' && Lampa.Controller) {
            Lampa.Controller.toggle('content');
          }
        } else if (selectedItem.action === 'delete') {
          try {
            await TorrPlayApi.deleteTorrent(instance, torrent.hash);
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
          if (typeof Lampa !== 'undefined' && Lampa.Controller) {
            Lampa.Controller.toggle('content');
          }
        }
      },
      title: menuTitle,
    });
  }

  public destroy(): void {
    this.stopPolling();
    if (this.emptyState && typeof this.emptyState.destroy === 'function') {
      this.emptyState.destroy();
    }
    this.scrollView.destroy();
    this.rootElement.remove();
  }
}
