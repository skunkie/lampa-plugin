// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayEngine } from './engine/torrplay-engine';
import { InstanceManager } from './instances/instance-manager';
import { initTranslations, translate } from './lang/translations';
import { ParserHook } from './providers/parser-hook';
import { ProviderManager } from './providers/provider-manager';
import { CatalogChoice } from './ui/catalog-choice';
import { SettingsUi } from './ui/settings';
import { SidebarManager } from './ui/sidebar';

export const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ !== 'undefined' ? __PLUGIN_VERSION__ : '1.0.0';

function initPlugin(): void {
  if (window.plugin_torrplay_ready) return;

  try {
    initTranslations();
    InstanceManager.init();
    ProviderManager.init();
    SettingsUi.init();
    SidebarManager.init();
    CatalogChoice.init();
    TorrPlayEngine.init();
    ParserHook.init();

    if (Lampa.Manifest) {
      Lampa.Manifest.plugins = {
        description: translate('torrplay_desc', 'Native TorrPlay client for torrent streaming'),
        name: 'TorrPlay',
        type: 'video',
        version: PLUGIN_VERSION,
      };
    }

    window.plugin_torrplay_ready = true;
    console.log(`[TorrPlay] Plugin v${PLUGIN_VERSION} initialized successfully`);
  } catch (error) {
    console.error('[TorrPlay] Failed to initialize plugin:', error);
  }
}

if (typeof window !== 'undefined') {
  if (window.appready) {
    initPlugin();
  } else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
    Lampa.Listener.follow('app', (event: { type: string }) => {
      if (event.type === 'ready') {
        initPlugin();
      }
    });
  } else {
    // Fallback timer for environments where Lampa loads asynchronously
    const checkTimer = setInterval(() => {
      if (typeof Lampa !== 'undefined' && (window.appready || Lampa.Storage)) {
        clearInterval(checkTimer);
        initPlugin();
      }
    }, 200);
  }
}
