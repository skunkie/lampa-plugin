// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { translate } from '../lang/translations';
import { PLUGIN_BUILD_COMMIT, PLUGIN_BUILD_DATE, PLUGIN_VERSION } from '../version';
import { ICON_ARROW_LEFT, iconLabel } from './settings';

export class AboutUi {
  public static show(selectedIndex = 0): void {
    const unknown = translate('torrplay_about_unknown', 'Unknown');
    const formattedBuildDate = PLUGIN_BUILD_DATE ? new Date(PLUGIN_BUILD_DATE).toLocaleString() : unknown;

    const menuItems: LampaSelectItem[] = [
      {
        subtitle: PLUGIN_VERSION,
        title: translate('torrplay_about_version', 'Version'),
      },
      {
        subtitle: formattedBuildDate,
        title: translate('torrplay_about_build_date', 'Build Date'),
      },
      {
        subtitle: PLUGIN_BUILD_COMMIT || unknown,
        title: translate('torrplay_about_build_commit', 'Commit'),
      },
      {
        action: 'back',
        subtitle: translate('torrplay_back_to_settings', 'Return to TorrPlay settings'),
        title: iconLabel(ICON_ARROW_LEFT, translate('torrplay_back', 'Back')),
      },
    ];

    menuItems.forEach((item, index) => {
      item.selected = index === selectedIndex;
    });

    Lampa.Select.show({
      items: menuItems,
      onBack: () => {
        AboutUi.backToSettings();
      },
      onSelect: (selectedItem: LampaSelectItem) => {
        if (selectedItem.action === 'back') {
          AboutUi.backToSettings();
          return;
        }

        // Informational rows have no action: Select closes on any pick, so reopen
        // the menu with the same row focused instead of falling back to settings.
        const index = menuItems.findIndex(item => item === selectedItem);

        AboutUi.show(index === -1 ? 0 : index);
      },
      title: translate('torrplay_about_title', 'About TorrPlay'),
    });
  }

  private static backToSettings(): void {
    if (typeof Lampa !== 'undefined' && Lampa.Controller) {
      Lampa.Controller.toggle('settings_component');
    }
  }
}
