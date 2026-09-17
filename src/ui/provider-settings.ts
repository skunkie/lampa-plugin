// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { translate } from '../lang/translations';
import { ProviderManager } from '../providers/provider-manager';
import { ProviderType, TorrentProvider } from '../types/provider';
import { generateUuid } from '../utils/uuid';
import {
  ICON_ARROW_LEFT,
  ICON_DOWNLOAD,
  ICON_KEY,
  ICON_PENCIL,
  ICON_PLUS,
  ICON_TRASH,
  ICON_ZAP,
  iconLabel,
} from './settings';

function normalizeProviderUrl(value: string): string | null {
  let cleanUrl = value.trim().replace(/\/+$/, '');
  if (!cleanUrl) return null;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//i.test(cleanUrl)) {
    cleanUrl = `http://${cleanUrl}`;
  }
  try {
    const parsed = new URL(cleanUrl);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
      return null;
    }
    return cleanUrl;
  } catch {
    return null;
  }
}

export class ProviderSettingsUi {
  public static openPoolManager(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Select) return;

    const providers = ProviderManager.getProviders();

    const menuItems: Array<LampaSelectItem<TorrentProvider>> = [
      {
        action: 'add',
        subtitle: translate('torrplay_provider_add_descr', 'Add a new Jackett or Prowlarr search provider'),
        title: iconLabel(ICON_PLUS, translate('torrplay_provider_add', 'Add Provider')),
      },
      {
        action: 'ping_all',
        subtitle: translate('torrplay_provider_test_all_descr', 'Test latency across all providers'),
        title: iconLabel(ICON_ZAP, translate('torrplay_provider_test_all', 'Test All Providers')),
      },
    ];

    providers.forEach(provider => {
      let statusDescription = translate('torrplay_status_unknown', 'Unknown');
      if (provider.status === 'online' && provider.latencyMs !== undefined && provider.latencyMs < Infinity) {
        statusDescription = `${provider.latencyMs} ms`;
      } else if (provider.status === 'offline') {
        statusDescription = translate('torrplay_status_offline', 'Offline');
      } else if (provider.status === 'checking') {
        statusDescription = translate('torrplay_status_checking', 'Checking...');
      }
      const enabledTag = provider.isEnabled
        ? translate('torrplay_status_enabled', 'Enabled')
        : translate('torrplay_status_disabled', 'Disabled');

      menuItems.push({
        action: 'provider',
        data: provider,
        selected: provider.isEnabled,
        subtitle: `${provider.url} · ${statusDescription} · ${enabledTag}`,
        title: `[${provider.type === 'prowlarr' ? 'Prowlarr' : 'Jackett'}] ${provider.name}`,
      });
    });

    menuItems.push({
      action: 'back',
      subtitle: translate('torrplay_back_to_settings', 'Return to TorrPlay settings'),
      title: iconLabel(ICON_ARROW_LEFT, translate('torrplay_back', 'Back')),
    });

    Lampa.Select.show({
      items: menuItems,
      onBack: () => {
        if (typeof Lampa !== 'undefined' && Lampa.Controller) {
          Lampa.Controller.toggle('settings_component');
        }
      },
      onSelect: (selectedItem: LampaSelectItem<TorrentProvider>) => {
        if (selectedItem.action === 'back') {
          if (typeof Lampa !== 'undefined' && Lampa.Controller) {
            Lampa.Controller.toggle('settings_component');
          }
        } else if (selectedItem.action === 'add') {
          this.promptAddProvider();
        } else if (selectedItem.action === 'ping_all') {
          if (Lampa.Noty) Lampa.Noty.show(translate('torrplay_provider_noty_pinging_all', 'Testing all search providers...'));
          ProviderManager.pingAll().then(() => {
            this.openPoolManager();
          });
        } else if (selectedItem.action === 'provider' && selectedItem.data) {
          this.openProviderActions(selectedItem.data);
        }
      },
      title: translate('torrplay_provider_pool_title', 'Torrent Search Providers'),
    });
  }

  public static openProviderActions(provider: TorrentProvider): void {
    if (typeof Lampa === 'undefined' || !Lampa.Select) return;

    const menuItems: LampaSelectItem[] = [
      {
        action: 'toggle_enabled',
        subtitle: provider.isEnabled
          ? translate('torrplay_provider_disable_descr', 'Exclude this provider from search')
          : translate('torrplay_provider_enable_descr', 'Include this provider in search'),
        title: iconLabel(
          ICON_DOWNLOAD,
          provider.isEnabled
            ? translate('torrplay_provider_disable', 'Disable Provider')
            : translate('torrplay_provider_enable', 'Enable Provider')
        ),
      },
      {
        action: 'test',
        subtitle: translate('torrplay_test_conn_descr', 'Ping health endpoint and measure response time'),
        title: iconLabel(ICON_ZAP, translate('torrplay_test_conn', 'Test Connection')),
      },
      {
        action: 'edit_name',
        subtitle: translate('torrplay_current_value', `Current: ${provider.name}`, { value: provider.name }),
        title: iconLabel(ICON_PENCIL, translate('torrplay_edit_name', 'Edit Name')),
      },
      {
        action: 'edit_url',
        subtitle: translate('torrplay_current_value', `Current: ${provider.url}`, { value: provider.url }),
        title: iconLabel(ICON_PENCIL, translate('torrplay_edit_url', 'Edit Instance URL')),
      },
      {
        action: 'edit_api_key',
        subtitle: provider.apiKey ? '••••••••' : translate('torrplay_value_none', '(none)'),
        title: iconLabel(ICON_KEY, translate('torrplay_provider_edit_api_key', 'Edit API Key')),
      },
      {
        action: 'switch_type',
        subtitle: translate('torrplay_current_value', `Current: ${provider.type}`, {
          value: provider.type === 'prowlarr' ? 'Prowlarr' : 'Jackett',
        }),
        title: iconLabel(ICON_PENCIL, translate('torrplay_provider_switch_type', 'Switch Provider Type')),
      },
      {
        action: 'delete',
        subtitle: translate('torrplay_provider_delete_descr', 'Remove this provider from the pool'),
        title: iconLabel(ICON_TRASH, translate('torrplay_provider_delete', 'Delete Provider')),
      },
      {
        action: 'back',
        subtitle: translate('torrplay_back_to_instances', 'Return to instance list'),
        title: iconLabel(ICON_ARROW_LEFT, translate('torrplay_back', 'Back')),
      },
    ];

    Lampa.Select.show({
      items: menuItems,
      onBack: () => {
        this.openPoolManager();
      },
      onSelect: (selectedItem: LampaSelectItem) => {
        if (selectedItem.action === 'toggle_enabled') {
          provider.isEnabled = !provider.isEnabled;
          ProviderManager.updateProvider(provider);
          this.openProviderActions(provider);
        } else if (selectedItem.action === 'test') {
          if (Lampa.Noty) {
            Lampa.Noty.show(translate('torrplay_noty_testing', `Testing ${provider.url}...`, { url: provider.url }));
          }
          ProviderManager.checkHealth(provider).then(healthResult => {
            ProviderManager.updateProvider(provider);
            if (Lampa.Noty) {
              Lampa.Noty.show(
                healthResult.isOk
                  ? translate('torrplay_noty_connected', `Connected! Latency: ${healthResult.latencyMs} ms`, {
                    latency: healthResult.latencyMs ?? 0,
                  })
                  : translate('torrplay_noty_failed_connect', `Failed to connect to ${provider.url}`, { url: provider.url })
              );
            }
            this.openProviderActions(provider);
          });
        } else if (selectedItem.action === 'edit_name') {
          if (Lampa.Input) {
            Lampa.Input.edit({
              free: true,
              nosave: true,
              title: translate('torrplay_edit_name', 'Provider Name'),
              value: provider.name,
            }, value => {
              if (value && value.trim()) {
                provider.name = value.trim();
                ProviderManager.updateProvider(provider);
              }
              this.openProviderActions(provider);
            });
          }
        } else if (selectedItem.action === 'edit_url') {
          this.promptEditProviderUrl(provider);
        } else if (selectedItem.action === 'edit_api_key') {
          if (Lampa.Input) {
            Lampa.Input.edit({
              free: true,
              nosave: true,
              password: true,
              title: translate('torrplay_provider_edit_api_key', 'API Key'),
              value: provider.apiKey || '',
            }, value => {
              provider.apiKey = value ? value.trim() : '';
              ProviderManager.updateProvider(provider);
              this.openProviderActions(provider);
            });
          }
        } else if (selectedItem.action === 'switch_type') {
          const nextType: ProviderType = provider.type === 'prowlarr' ? 'jackett' : 'prowlarr';
          provider.type = nextType;
          ProviderManager.updateProvider(provider);
          this.openProviderActions(provider);
        } else if (selectedItem.action === 'delete') {
          this.confirmDeleteProvider(provider);
        } else if (selectedItem.action === 'back') {
          this.openPoolManager();
        }
      },
      title: provider.name,
    });
  }

  public static promptEditProviderUrl(provider: TorrentProvider, initialValue?: string): void {
    if (typeof Lampa === 'undefined' || !Lampa.Input) return;

    const currentUrl = initialValue !== undefined ? initialValue : provider.url;

    Lampa.Input.edit({
      free: true,
      nosave: true,
      title: translate('torrplay_edit_url', 'Provider URL'),
      value: currentUrl,
    }, value => {
      const rawInput = (value || '').trim();

      if (!rawInput || rawInput === provider.url) {
        this.openProviderActions(provider);
        return;
      }

      const cleanUrl = normalizeProviderUrl(rawInput);
      if (!cleanUrl) {
        if (Lampa.Noty) {
          Lampa.Noty.show(translate('torrplay_noty_valid_url', 'Enter a valid HTTP or HTTPS instance URL'));
        }
        this.promptEditProviderUrl(provider, rawInput);
        return;
      }

      if (cleanUrl === provider.url) {
        this.openProviderActions(provider);
        return;
      }

      const isDuplicate = ProviderManager.getProviders().some(
        candidate => candidate.id !== provider.id && candidate.url === cleanUrl
      );
      if (isDuplicate) {
        if (Lampa.Noty) {
          Lampa.Noty.show(translate('torrplay_noty_duplicate_url', 'An instance with this URL already exists'));
        }
        this.promptEditProviderUrl(provider, rawInput);
        return;
      }

      provider.url = cleanUrl;
      provider.status = 'unknown';
      delete provider.latencyMs;
      ProviderManager.updateProvider(provider);
      if (Lampa.Noty) {
        Lampa.Noty.show(translate('torrplay_noty_url_updated', 'Instance URL updated'));
      }
      this.openProviderActions(provider);
    });
  }

  public static promptAddProvider(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Input) return;

    Lampa.Input.edit({
      free: true,
      nosave: true,
      title: translate('torrplay_instance_url_placeholder', 'Instance URL (e.g. http://192.168.1.100:8090)'),
      value: 'http://',
    }, providerUrlInput => {
      if (!providerUrlInput || !providerUrlInput.trim() || providerUrlInput.trim() === 'http://') {
        this.openPoolManager();
        return;
      }
      const normalizedUrl = normalizeProviderUrl(providerUrlInput);
      if (!normalizedUrl) {
        if (Lampa.Noty) {
          Lampa.Noty.show(translate('torrplay_noty_valid_url', 'Enter a valid HTTP or HTTPS instance URL'));
        }
        this.openPoolManager();
        return;
      }
      const isDuplicate = ProviderManager.getProviders().some(candidate => candidate.url === normalizedUrl);
      if (isDuplicate) {
        if (Lampa.Noty) {
          Lampa.Noty.show(translate('torrplay_noty_duplicate_url', 'An instance with this URL already exists'));
        }
        this.openPoolManager();
        return;
      }

      const parsed = new URL(normalizedUrl);
      const defaultName = parsed.hostname;

      const newProvider: TorrentProvider = {
        id: generateUuid(),
        isEnabled: true,
        name: defaultName,
        status: 'unknown',
        type: 'jackett',
        url: normalizedUrl,
      };
      ProviderManager.addProvider(newProvider);
      if (Lampa.Noty) {
        Lampa.Noty.show(translate('torrplay_provider_noty_added', `Added ${newProvider.name} to pool`, { name: newProvider.name }));
      }
      this.openProviderActions(newProvider);
    });
  }

  private static confirmDeleteProvider(provider: TorrentProvider): void {
    if (typeof Lampa === 'undefined' || !Lampa.Select) return;

    Lampa.Select.show({
      items: [
        {
          action: 'confirm_delete',
          subtitle: translate('torrplay_provider_confirm_delete_descr', 'This also removes its saved API key'),
          title: translate('torrplay_confirm_delete_name', `Delete ${provider.name}`, { name: provider.name }),
        },
        {
          action: 'cancel',
          subtitle: translate('torrplay_keep_instance', 'Keep this instance'),
          title: translate('torrplay_cancel', 'Cancel'),
        },
      ],
      onBack: () => {
        this.openProviderActions(provider);
      },
      onSelect: (selectedItem: LampaSelectItem) => {
        if (selectedItem.action !== 'confirm_delete') {
          this.openProviderActions(provider);
          return;
        }

        ProviderManager.removeProvider(provider.id);
        if (Lampa.Noty) {
          Lampa.Noty.show(translate('torrplay_provider_noty_deleted', `Deleted ${provider.name}`, { name: provider.name }));
        }
        this.openPoolManager();
      },
      title: translate('torrplay_confirm_delete_title', 'Delete Instance?'),
    });
  }
}
