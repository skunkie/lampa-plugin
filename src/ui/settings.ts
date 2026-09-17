// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { InstanceManager, SelectionMode } from '../instances/instance-manager';
import { translate } from '../lang/translations';
import {
  GLOBAL_SEARCH_ENABLED_STORAGE_KEY,
  ProviderManager,
  STORAGE_KEY_PROVIDERS,
} from '../providers/provider-manager';
import { AboutUi } from './about';
import { InstancePoolUi } from './instance-pool';
import { SAVE_TO_DATABASE_STORAGE_KEY, STORAGE_TYPE_STORAGE_KEY } from './play-dialog';
import { ProviderSettingsUi } from './provider-settings';

export const PLAYBACK_MODE_STORAGE_KEY = 'torrplay_playback_mode';
export const PRELOAD_ENABLED_STORAGE_KEY = 'torrplay_preload_enabled';
export const TORRPLAY_ENABLED_STORAGE_KEY = 'torrplay_enabled';
export const TORRPLAY_SETTINGS_COMPONENT_ID = 'torrplay_settings';

export const TORRPLAY_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M 6 16.5 C 3.8 16.2 2 14.3 2 12 C 2 9.5 3.9 7.4 6.4 7.1 C 7 4.2 9.5 2 12.5 2 C 16.1 2 19.1 4.7 19.6 8.2 C 21.5 8.7 23 10.4 23 12.5 C 23 14.7 21.3 16.4 19.2 16.6" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 6.8 6.5 C 8 5.2 9.6 4.5 11.5 4.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M 10.38 9.24 L 13.62 9.24 L 13.21 10.85 A 4.8 4.8 0 0 1 15.60 12.23 L 16.79 11.08 L 18.41 13.88 L 16.80 14.33 A 4.8 4.8 0 0 1 16.80 17.07 L 18.41 17.52 L 16.79 20.32 L 15.60 19.17 A 4.8 4.8 0 0 1 13.21 20.55 L 13.62 22.16 L 10.38 22.16 L 10.79 20.55 A 4.8 4.8 0 0 1 8.40 19.17 L 7.21 20.32 L 5.59 17.52 L 7.20 17.07 A 4.8 4.8 0 0 1 7.20 14.33 L 5.59 13.88 L 7.21 11.08 L 8.40 12.23 A 4.8 4.8 0 0 1 10.79 10.85 Z M 10.6 13.3 C 10.6 12.6 11.3 12.2 11.9 12.5 L 14.8 14.8 C 15.4 15.2 15.4 16.0 14.8 16.4 L 11.9 18.7 C 11.3 19.0 10.6 18.6 10.6 17.9 Z" fill="white"/>
</svg>
`;

const ICON_ATTRS = 'width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1em !important;height:1em !important;min-width:1em !important;max-width:1em !important;display:inline-block;vertical-align:middle;flex-shrink:0"';

export const ICON_ARROW_LEFT = `<svg ${ICON_ATTRS}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
export const ICON_DATABASE   = `<svg ${ICON_ATTRS}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>`;
export const ICON_DOWNLOAD   = `<svg ${ICON_ATTRS}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;
export const ICON_KEY        = `<svg ${ICON_ATTRS}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`;
export const ICON_LOCK       = `<svg ${ICON_ATTRS}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
export const ICON_PENCIL     = `<svg ${ICON_ATTRS}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
export const ICON_PLUS       = `<svg ${ICON_ATTRS}><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
export const ICON_STAR       = `<svg ${ICON_ATTRS}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
export const ICON_TRASH      = `<svg ${ICON_ATTRS}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
export const ICON_USER       = `<svg ${ICON_ATTRS}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
export const ICON_ZAP        = `<svg ${ICON_ATTRS}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

export function iconLabel(icon: string, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:0.5em">${icon}${label}</span>`;
}

export class SettingsUi {
  public static init(): void {
    if (!Lampa.SettingsApi) return;

    Lampa.SettingsApi.addComponent({
      // 'tmdb' is never conditionally removed, unlike 'parser'/'server' (dropped
      // when torrents_use is disabled) — anchoring to a removed component id is a no-op.
      before: 'tmdb',
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      icon: TORRPLAY_ICON,
      name: translate('torrplay_settings_name', 'TorrPlay'),
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate('torrplay_enabled_descr', 'Handle torrent playback and streaming via TorrPlay'),
        name: translate('torrplay_enabled_name', 'Enable TorrPlay'),
      },
      onChange: () => {
        this.updateTorrServerVisibility();
      },
      param: {
        default: true,
        name: TORRPLAY_ENABLED_STORAGE_KEY,
        type: 'trigger',
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate(
          'torrplay_global_search_descr',
          'Include torrent provider results in Lampa global search'
        ),
        name: translate('torrplay_global_search_name', 'Show Torrents in Global Search'),
      },
      param: {
        default: false,
        name: GLOBAL_SEARCH_ENABLED_STORAGE_KEY,
        type: 'trigger',
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate(
          'torrplay_selection_mode_descr',
          'Auto-route to lowest-latency instance or use manually selected active instance'
        ),
        name: translate('torrplay_selection_mode_name', 'Instance Pool Selection'),
      },
      onChange: (selectionMode: string) => {
        InstanceManager.setMode(selectionMode as SelectionMode);
        if (selectionMode === 'manual') {
          InstancePoolUi.promptSelectActiveInstance();
        }
      },
      param: {
        default: 'auto',
        name: 'torrplay_selection_mode',
        type: 'select',
        values: {
          auto: translate('torrplay_selection_mode_auto', 'Auto (Lowest Latency)'),
          manual: translate('torrplay_selection_mode_manual', 'Manual Selection'),
        },
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate(
          'torrplay_manage_pool_descr',
          'Configure instances, credentials, active instance, and latency benchmarks'
        ),
        name: translate('torrplay_manage_pool_name', 'Manage Instance Pool'),
      },
      onChange: () => {
        InstancePoolUi.openPoolManager();
      },
      param: {
        name: 'torrplay_instances_btn',
        type: 'button',
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate(
          'torrplay_manage_providers_descr',
          'Configure Jackett/Prowlarr search providers used to find torrents'
        ),
        name: translate('torrplay_manage_providers_name', 'Manage Search Providers'),
      },
      onChange: () => {
        ProviderSettingsUi.openPoolManager();
      },
      param: {
        name: 'torrplay_providers_btn',
        type: 'button',
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate('torrplay_playback_mode_descr', 'How to handle torrent playback selection in Lampa'),
        name: translate('torrplay_playback_mode_name', 'Player in Catalog & Cards'),
      },
      onChange: () => {
        this.updateTorrServerVisibility();
      },
      param: {
        default: 'torrplay',
        name: PLAYBACK_MODE_STORAGE_KEY,
        type: 'select',
        values: {
          torrplay: translate('torrplay_playback_mode_torrplay', 'Always TorrPlay'),
          context: translate('torrplay_playback_mode_context', 'Manual (Context Menu & Button)'),
          ask: translate('torrplay_playback_mode_ask', 'Ask Before Play (TorrPlay / TorrServer)'),
        },
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate('torrplay_storage_type_descr', 'Where TorrPlay caches pieces during playback'),
        name: translate('torrplay_storage_type_name', 'Storage Type'),
      },
      param: {
        default: 'memory',
        name: STORAGE_TYPE_STORAGE_KEY,
        type: 'select',
        values: {
          ask: translate('torrplay_storage_type_ask', 'Ask Before Play'),
          file: translate('torrplay_storage_type_disk', 'Disk'),
          memory: translate('torrplay_storage_type_ram', 'RAM'),
        },
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate('torrplay_save_to_db_descr', 'Save torrent in TorrPlay database or stream temporarily'),
        name: translate('torrplay_save_to_db_name', 'Database Persistence'),
      },
      param: {
        default: 'false',
        name: SAVE_TO_DATABASE_STORAGE_KEY,
        type: 'select',
        values: {
          ask: translate('torrplay_save_to_db_ask', 'Ask Before Play'),
          false: translate('torrplay_save_to_db_false', 'Do Not Save'),
          true: translate('torrplay_save_to_db_true', 'Save to Database'),
        },
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate('torrplay_preload_descr', 'Buffer pieces before opening the player'),
        name: translate('torrplay_preload_name', 'Preload Stream'),
      },
      param: {
        default: true,
        name: PRELOAD_ENABLED_STORAGE_KEY,
        type: 'trigger',
      },
    });

    Lampa.SettingsApi.addParam({
      component: TORRPLAY_SETTINGS_COMPONENT_ID,
      field: {
        description: translate('torrplay_about_descr', 'View the installed plugin version and build info'),
        name: translate('torrplay_about_name', 'About Plugin'),
      },
      onChange: () => {
        AboutUi.show();
      },
      param: {
        name: 'torrplay_about_btn',
        type: 'button',
      },
    });

    this.updateTorrServerVisibility();

    if (typeof Lampa !== 'undefined' && Lampa.Storage?.listener) {
      Lampa.Storage.listener.follow('change', (event: LampaStorageChangeEvent) => {
        if (
          event.name === PLAYBACK_MODE_STORAGE_KEY
          || event.name === STORAGE_KEY_PROVIDERS
          || event.name === TORRPLAY_ENABLED_STORAGE_KEY
        ) {
          this.updateTorrServerVisibility();
        }
      });
    }
  }

  public static updateTorrServerVisibility(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Storage) return;
    const isEnabled = Lampa.Storage.get<boolean>(TORRPLAY_ENABLED_STORAGE_KEY, true);
    const playbackMode = Lampa.Storage.get<string>(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
    const isAlwaysTorrPlay = isEnabled && playbackMode === 'torrplay';
    const shouldHideNativeParser = isEnabled && ProviderManager.getEnabledProviders().length > 0;

    if (typeof document !== 'undefined') {
      const styleId = 'torrplay-hide-torrserver-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          body.torrplay--hide-torrserver .settings-folder[data-component="server"],
          body.torrplay--hide-torrserver .settings-folder[data-component="torserver"],
          body.torrplay--hide-torrserver .settings-folder[data-component="parser"],
          body.torrplay--hide-torrserver .menu__item[data-action="mytorrents"],
          body.torrplay--hide-torrserver .menu__item[data-action="torrents"],
          body.torrplay--hide-torrserver [data-action="mytorrents"],
          body.torrplay--hide-torrserver [data-action="torrents"],
          body.torrplay--hide-torrserver .full-start__button.view--torrent,
          body.torrplay--hide-torrserver .view--torrent {
            display: none !important;
          }
          body.torrplay--hide-native-parser .settings-folder[data-component="parser"] {
            display: none !important;
          }
        `;
        if (document.head) {
          document.head.appendChild(style);
        }
      }
      const jquery = (globalThis as typeof globalThis & { $?: LampaJQuery }).$
        || (typeof window !== 'undefined' ? window.$ : undefined);
      const targetSelector = '[data-action="mytorrents"], [data-action="torrents"], .settings-folder[data-component="server"], .settings-folder[data-component="torserver"], .settings-folder[data-component="parser"], .view--torrent';
      if (typeof jquery !== 'undefined' && typeof jquery('body').toggleClass === 'function') {
        jquery('body').toggleClass('torrplay--hide-torrserver', isAlwaysTorrPlay);
        jquery('body').toggleClass('torrplay--hide-native-parser', shouldHideNativeParser);
        const nativeElements = jquery(targetSelector);
        if (nativeElements && typeof nativeElements.toggleClass === 'function') {
          nativeElements.toggleClass('hide', isAlwaysTorrPlay);
          nativeElements.toggleClass('selector', !isAlwaysTorrPlay);
        }
      } else if (document.body) {
        document.body.classList.toggle('torrplay--hide-torrserver', isAlwaysTorrPlay);
        document.body.classList.toggle('torrplay--hide-native-parser', shouldHideNativeParser);
        if (typeof document.querySelectorAll === 'function') {
          const nativeElements = document.querySelectorAll(targetSelector);
          nativeElements.forEach(element => {
            if (element && element.classList) {
              element.classList.toggle('hide', isAlwaysTorrPlay);
              element.classList.toggle('selector', !isAlwaysTorrPlay);
            }
          });
        }
      }
    }
  }
}
