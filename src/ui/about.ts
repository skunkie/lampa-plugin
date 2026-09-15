// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { translate } from '../lang/translations';
import { PLUGIN_BUILD_COMMIT, PLUGIN_BUILD_DATE, PLUGIN_VERSION } from '../version';
import { ICON_ARROW_LEFT, iconLabel } from './settings';

export class AboutUi {
  public static show(): void {
    const unknown = translate('torrplay_about_unknown', 'Unknown');
    const formattedBuildDate = PLUGIN_BUILD_DATE ? new Date(PLUGIN_BUILD_DATE).toLocaleString() : unknown;

    const menuItems: LampaSelectItem[] = [
      {
        selected: false,
        subtitle: PLUGIN_VERSION,
        title: translate('torrplay_about_version', 'Version'),
      },
      {
        selected: false,
        subtitle: formattedBuildDate,
        title: translate('torrplay_about_build_date', 'Build Date'),
      },
      {
        selected: false,
        subtitle: PLUGIN_BUILD_COMMIT || unknown,
        title: translate('torrplay_about_build_commit', 'Commit'),
      },
      {
        action: 'back',
        subtitle: translate('torrplay_back_to_settings', 'Return to TorrPlay settings'),
        title: iconLabel(ICON_ARROW_LEFT, translate('torrplay_back', 'Back')),
      },
    ];

    Lampa.Select.show({
      items: menuItems,
      onBack: () => {
        if (typeof Lampa !== 'undefined' && Lampa.Controller) {
          Lampa.Controller.toggle('settings_component');
        }
      },
      onSelect: (selectedItem: LampaSelectItem) => {
        if (selectedItem.action === 'back' && typeof Lampa !== 'undefined' && Lampa.Controller) {
          Lampa.Controller.toggle('settings_component');
        }
      },
      title: translate('torrplay_about_title', 'About TorrPlay'),
    });
  }
}
