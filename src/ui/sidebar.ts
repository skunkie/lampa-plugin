// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { SettingsUi, TORRPLAY_ICON } from './settings';
import { TORRPLAY_TORRENTS_COMPONENT_ID, TorrPlayTorrentsComponent } from './torrplay-torrents';

const MENU_SORT_STORAGE_KEY = 'menu_sort';
const SIDEBAR_ITEM_LABEL = 'TorrPlay';

export class SidebarManager {
  private static isRegistered = false;

  /**
   * Lampa's own menu editor (interaction/menu/menu.js + editor.js) persists a custom
   * item order under Storage key "menu_sort" (an array of `.menu__text` labels) and
   * re-applies it after any menu DOM mutation, appending any label not yet present in
   * that order to its end. Registering our label here, right after the anchor item,
   * keeps Lampa's own reorder pass consistent with the position we just inserted at.
   */
  private static registerInMenuSortOrder(anchorLabel: string): void {
    if (typeof Lampa === 'undefined' || !Lampa.Storage) return;

    const savedOrder = Lampa.Storage.get<string[]>(MENU_SORT_STORAGE_KEY, []);
    const order = (Array.isArray(savedOrder) ? savedOrder : []).filter(label => label !== SIDEBAR_ITEM_LABEL);
    const anchorIndex = anchorLabel ? order.indexOf(anchorLabel) : -1;
    order.splice(anchorIndex === -1 ? 0 : anchorIndex + 1, 0, SIDEBAR_ITEM_LABEL);

    Lampa.Storage.set(MENU_SORT_STORAGE_KEY, order);
  }

  public static init(): void {
    if (this.isRegistered) return;
    this.isRegistered = true;

    // Register TorrPlay Torrents component
    if (typeof Lampa !== 'undefined' && Lampa.Component) {
      Lampa.Component.add(TORRPLAY_TORRENTS_COMPONENT_ID, TorrPlayTorrentsComponent);
    }

    const addSidebarButton = () => {
      const globalJquery = (globalThis as typeof globalThis & { $?: LampaJQuery }).$;
      const jquery = typeof globalJquery !== 'undefined'
        ? globalJquery
        : (typeof window !== 'undefined' ? window.$ : undefined);
      if (typeof jquery === 'undefined') return;

      SettingsUi.updateTorrServerVisibility();

      if (jquery('.menu__item[data-action="torrplay"]').length) return;

      const primaryMenuList = jquery('.menu .menu__list:eq(0)');
      if (!primaryMenuList.length) return;

      // Positioned as the second entry (right after whatever the menu's first item
      // is) rather than anchored to a specific native item, since native items added
      // later are always appended to the end of the list. If the list has no children
      // yet, bail out without inserting — a later retrigger (menu open/close) retries
      // once there's a first item to anchor to.
      const firstMenuItem = primaryMenuList.children().first();
      if (!firstMenuItem.length) return;

      const sidebarItem = jquery(`
        <li class="menu__item selector" data-action="torrplay">
          <div class="menu__ico">${TORRPLAY_ICON}</div>
          <div class="menu__text">${SIDEBAR_ITEM_LABEL}</div>
        </li>
      `);

      sidebarItem.on('hover:enter', () => {
        Lampa.Activity.push({
          component: TORRPLAY_TORRENTS_COMPONENT_ID,
          page: 1,
          title: SIDEBAR_ITEM_LABEL,
          url: '',
        });
      });

      firstMenuItem.after(sidebarItem);
      this.registerInMenuSortOrder(firstMenuItem.find('.menu__text').text());

      SettingsUi.updateTorrServerVisibility();
    };

    if (typeof window !== 'undefined' && window.appready) {
      addSidebarButton();
    }

    if (typeof Lampa !== 'undefined' && Lampa.Listener) {
      Lampa.Listener.follow('app', (event: { type?: string }) => {
        if (event.type === 'ready') {
          addSidebarButton();
        }
      });

      Lampa.Listener.follow('menu', (event: { type?: string }) => {
        if (event.type === 'start' || event.type === 'toggle' || event.type === 'end') {
          addSidebarButton();
        }
      });

      Lampa.Listener.follow('activity', () => {
        SettingsUi.updateTorrServerVisibility();
      });
    }
  }
}
