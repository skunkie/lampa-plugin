// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { InstanceManager } from '../instances/instance-manager';
import { translate } from '../lang/translations';
import { TorrPlayInstance } from '../types/torrplay';
import { generateUuid } from '../utils/uuid';
import {
  ICON_ARROW_LEFT,
  ICON_DATABASE,
  ICON_DOWNLOAD,
  ICON_KEY,
  ICON_LOCK,
  ICON_PENCIL,
  ICON_PLUS,
  ICON_STAR,
  ICON_TRASH,
  ICON_USER,
  ICON_ZAP,
  iconLabel,
} from './settings';

interface AuthenticationSelectItem extends LampaSelectItem {
  auth: TorrPlayInstance['authType']
}

function normalizeInstanceUrl(value: string): string | null {
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

export class InstancePoolUi {
  public static openPoolManager(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Select) return;

    const instances = InstanceManager.getInstances();
    const selectionMode = InstanceManager.getMode();
    const activeInstance = InstanceManager.getPrimaryInstance();

    const menuItems: Array<LampaSelectItem<TorrPlayInstance>> = [
      {
        action: 'add',
        subtitle: translate('torrplay_add_instance_descr', 'Add a new TorrPlay instance to the pool'),
        title: iconLabel(ICON_PLUS, translate('torrplay_add_instance', 'Add Instance')),
      },
      {
        action: 'ping_all',
        subtitle: translate('torrplay_test_all_descr', 'Test latency across all pool instances'),
        title: iconLabel(ICON_ZAP, translate('torrplay_test_all', 'Test All Instances')),
      },
    ];

    if (selectionMode === 'manual') {
      menuItems.push({
        action: 'set_active',
        subtitle: translate('torrplay_change_active_descr', 'Choose which instance handles playback'),
        title: iconLabel(ICON_STAR, translate('torrplay_change_active', 'Change Active Instance')),
      });
    }

    instances.forEach(instance => {
      const isActive = instance.id === activeInstance?.id;
      let statusDescription = translate('torrplay_status_unknown', 'Unknown');
      if (instance.status === 'online' && instance.latencyMs !== undefined && instance.latencyMs < Infinity) {
        statusDescription = `${instance.latencyMs} ms`;
      } else if (instance.status === 'offline') {
        statusDescription = translate('torrplay_status_offline', 'Offline');
      } else if (instance.status === 'checking') {
        statusDescription = translate('torrplay_status_checking', 'Checking...');
      }

      const activeTag = isActive
        ? (selectionMode === 'auto'
          ? translate('torrplay_active_auto_badge', ' [Active (Auto)]')
          : translate('torrplay_active_badge', ' [Active]'))
        : '';
      const authLabel = instance.authType === 'basic' ? 'Basic' : instance.authType === 'bearer' ? 'Bearer' : '';
      const authenticationTag = authLabel ? ` · Auth: ${authLabel}` : '';

      menuItems.push({
        action: 'instance',
        data: instance,
        selected: isActive,
        subtitle: `${instance.url} · ${statusDescription}${authenticationTag}`,
        title: `${instance.name}${activeTag}`,
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
      onSelect: (selectedItem: LampaSelectItem<TorrPlayInstance>) => {
        if (selectedItem.action === 'back') {
          if (typeof Lampa !== 'undefined' && Lampa.Controller) {
            Lampa.Controller.toggle('settings_component');
          }
        } else if (selectedItem.action === 'add') {
          this.promptAddInstance();
        } else if (selectedItem.action === 'ping_all') {
          if (Lampa.Noty) Lampa.Noty.show(translate('torrplay_noty_pinging_all', 'Pinging all TorrPlay instances...'));
          InstanceManager.pingAll().then(() => {
            this.openPoolManager();
          });
        } else if (selectedItem.action === 'set_active') {
          this.promptSelectActiveInstance();
        } else if (selectedItem.action === 'instance' && selectedItem.data) {
          this.openInstanceActions(selectedItem.data);
        }
      },
      title: translate('torrplay_pool_title', `TorrPlay Pool (${selectionMode === 'auto' ? 'Auto Mode' : 'Manual Mode'})`, {
        mode: selectionMode === 'auto'
          ? translate('torrplay_pool_auto_mode', 'Auto Mode')
          : translate('torrplay_pool_manual_mode', 'Manual Mode'),
      }),
    });
  }

  public static promptSelectActiveInstance(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Select) return;

    const instances = InstanceManager.getInstances();
    if (instances.length === 0) {
      if (Lampa.Noty) {
        Lampa.Noty.show(translate('torrplay_noty_no_instances', 'Add an instance to the pool first'));
      }
      if (Lampa.Controller) Lampa.Controller.toggle('settings_component');
      return;
    }

    const activeInstance = InstanceManager.getPrimaryInstance();

    const menuItems = instances.map(instance => {
      const isActive = instance.id === activeInstance?.id;
      let statusDescription = translate('torrplay_status_unknown', 'Unknown');
      if (instance.status === 'online' && instance.latencyMs !== undefined && instance.latencyMs < Infinity) {
        statusDescription = `${instance.latencyMs} ms`;
      } else if (instance.status === 'offline') {
        statusDescription = translate('torrplay_status_offline', 'Offline');
      } else if (instance.status === 'checking') {
        statusDescription = translate('torrplay_status_checking', 'Checking...');
      }

      const authLabel = instance.authType === 'basic' ? 'Basic' : instance.authType === 'bearer' ? 'Bearer' : '';
      const authenticationTag = authLabel ? ` · Auth: ${authLabel}` : '';

      return {
        data: instance,
        selected: isActive,
        subtitle: `${instance.url} · ${statusDescription}${authenticationTag}`,
        title: `${instance.name}${isActive ? translate('torrplay_active_badge', ' [Active]') : ''}`,
      };
    });

    Lampa.Select.show({
      items: menuItems,
      onBack: () => {
        if (Lampa.Controller) Lampa.Controller.toggle('settings_component');
      },
      onSelect: (selectedItem: LampaSelectItem<TorrPlayInstance>) => {
        const instance = selectedItem.data;
        if (!instance) return;
        InstanceManager.setSelectedId(instance.id);
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_selected_active', `Selected ${instance.name} as active instance`, {
              name: instance.name,
            })
          );
        }
        if (Lampa.Controller) Lampa.Controller.toggle('settings_component');
      },
      title: translate('torrplay_select_active_title', 'Select Active Instance'),
    });
  }

  public static openInstanceActions(instance: TorrPlayInstance): void {
    if (typeof Lampa === 'undefined' || !Lampa.Select) return;

    if (typeof instance.fileStoragePath === 'undefined' || typeof instance.enableDownloader === 'undefined') {
      TorrPlayApi.getSettings(instance).then(settings => {
        let changed = false;
        if (settings && typeof settings.file_storage_path === 'string' && typeof instance.fileStoragePath === 'undefined') {
          instance.fileStoragePath = settings.file_storage_path;
          changed = true;
        }
        if (settings && typeof settings.enable_downloader === 'boolean' && typeof instance.enableDownloader === 'undefined') {
          instance.enableDownloader = settings.enable_downloader;
          changed = true;
        }
        if (changed) {
          InstanceManager.updateInstance(instance);
        }
      }).catch(() => {});
    }

    const menuItems: LampaSelectItem[] = [
      {
        action: 'test',
        subtitle: translate('torrplay_test_conn_descr', 'Ping health endpoint and measure response time'),
        title: iconLabel(ICON_ZAP, translate('torrplay_test_conn', 'Test Connection')),
      },
      {
        action: 'edit_name',
        subtitle: translate('torrplay_current_value', `Current: ${instance.name}`, { value: instance.name }),
        title: iconLabel(ICON_PENCIL, translate('torrplay_edit_name', 'Edit Name')),
      },
      {
        action: 'edit_url',
        subtitle: translate('torrplay_current_value', `Current: ${instance.url}`, { value: instance.url }),
        title: iconLabel(ICON_PENCIL, translate('torrplay_edit_url', 'Edit Instance URL')),
      },
      {
        action: 'edit_auth',
        subtitle: translate('torrplay_current_value', `Current: ${instance.authType === 'basic' ? 'Basic' : instance.authType === 'bearer' ? 'Bearer' : translate('torrplay_auth_none', 'None')}`, {
          value: instance.authType === 'basic' ? 'Basic' : instance.authType === 'bearer' ? 'Bearer' : translate('torrplay_auth_none', 'None'),
        }),
        title: iconLabel(ICON_LOCK, translate('torrplay_auth_mode', 'Authentication Mode')),
      },
    ];

    if (instance.authType === 'basic' || instance.authType === 'bearer') {
      menuItems.push({
        action: 'edit_username',
        subtitle: translate('torrplay_current_value', `Current: ${instance.username || '(none)'}`, {
          value: instance.username || translate('torrplay_value_none', '(none)'),
        }),
        title: iconLabel(ICON_USER, translate('torrplay_edit_username', 'Edit Username')),
      });
      menuItems.push({
        action: 'edit_password',
        subtitle: instance.password ? '••••••••' : translate('torrplay_value_none', '(none)'),
        title: iconLabel(ICON_KEY, translate('torrplay_edit_password', 'Edit Password')),
      });
    }

    menuItems.push({
      action: 'edit_storage_path',
      subtitle: translate('torrplay_current_value', `Current: ${instance.fileStoragePath || '(not set)'}`, {
        value: instance.fileStoragePath || translate('torrplay_status_not_set', '(not set)'),
      }),
      title: iconLabel(ICON_DATABASE, translate('torrplay_storage_path', 'File Storage Path')),
    });

    const isDownloaderEnabled = Boolean(instance.enableDownloader);
    menuItems.push({
      action: 'toggle_downloader',
      subtitle: translate('torrplay_current_value', `Current: ${isDownloaderEnabled ? 'Enabled' : 'Disabled'}`, {
        value: isDownloaderEnabled ? translate('torrplay_status_enabled', 'Enabled') : translate('torrplay_status_disabled', 'Disabled'),
      }),
      title: iconLabel(
        ICON_DOWNLOAD,
        isDownloaderEnabled
          ? translate('torrplay_disable_downloader', 'Disable Downloader')
          : translate('torrplay_enable_downloader', 'Enable Downloader')
      ),
    });

    menuItems.push({
      action: 'delete',
      subtitle: translate('torrplay_delete_instance_descr', 'Remove this instance from pool'),
      title: iconLabel(ICON_TRASH, translate('torrplay_delete_instance', 'Delete Instance')),
    });

    menuItems.push({
      action: 'back',
      subtitle: translate('torrplay_back_to_instances', 'Return to instance list'),
      title: iconLabel(ICON_ARROW_LEFT, translate('torrplay_back', 'Back')),
    });

    Lampa.Select.show({
      items: menuItems,
      onBack: () => {
        this.openPoolManager();
      },
      onSelect: (selectedItem: LampaSelectItem) => {
        if (selectedItem.action === 'test') {
          if (Lampa.Noty) {
            Lampa.Noty.show(
              translate('torrplay_noty_testing', `Testing ${instance.url}...`, { url: instance.url })
            );
          }
          TorrPlayApi.checkHealth(instance).then(healthResult => {
            if (healthResult.isOk) {
              TorrPlayApi.getSettings(instance).then(settings => {
                let changed = false;
                if (settings && typeof settings.file_storage_path === 'string') {
                  instance.fileStoragePath = settings.file_storage_path;
                  changed = true;
                }
                if (settings && typeof settings.enable_downloader === 'boolean') {
                  instance.enableDownloader = settings.enable_downloader;
                  changed = true;
                }
                if (changed) {
                  InstanceManager.updateInstance(instance);
                }
              }).catch(() => {});
              if (Lampa.Noty) {
                Lampa.Noty.show(
                  translate('torrplay_noty_connected', `Connected! Latency: ${healthResult.latencyMs} ms`, {
                    latency: healthResult.latencyMs ?? 0,
                  })
                );
              }
            } else {
              if (Lampa.Noty) {
                Lampa.Noty.show(
                  translate('torrplay_noty_failed_connect', `Failed to connect to ${instance.url}`, {
                    url: instance.url,
                  })
                );
              }
            }
            this.openInstanceActions(instance);
          });
        } else if (selectedItem.action === 'edit_name') {
          if (Lampa.Input) {
            Lampa.Input.edit({
              free: true,
              nosave: true,
              title: translate('torrplay_edit_name', 'Instance Name'),
              value: instance.name,
            }, value => {
              if (value && value.trim()) {
                instance.name = value.trim();
                InstanceManager.updateInstance(instance);
              }
              this.openInstanceActions(instance);
            });
          }
        } else if (selectedItem.action === 'edit_url') {
          this.promptEditInstanceUrl(instance);
        } else if (selectedItem.action === 'edit_auth') {
          Lampa.Select.show({
            items: [
              {
                auth: 'none',
                selected: instance.authType === 'none',
                subtitle: translate('torrplay_auth_none_descr', 'No credentials required'),
                title: translate('torrplay_auth_none', 'None'),
              },
              {
                auth: 'basic',
                selected: instance.authType === 'basic',
                subtitle: translate('torrplay_auth_basic_descr', 'HTTP Basic authentication'),
                title: 'Basic',
              },
              {
                auth: 'bearer',
                selected: instance.authType === 'bearer',
                subtitle: translate('torrplay_auth_bearer_descr', 'OAuth2 JWT authentication'),
                title: 'Bearer',
              },
            ],
            onBack: () => {
              this.openInstanceActions(instance);
            },
            onSelect: (selectedAuthentication: AuthenticationSelectItem) => {
              instance.authType = selectedAuthentication.auth;
              InstanceManager.updateInstance(instance);
              this.openInstanceActions(instance);
            },
            title: translate('torrplay_auth_mode', 'Authentication Mode'),
          });
        } else if (selectedItem.action === 'edit_username') {
          if (Lampa.Input) {
            Lampa.Input.edit({
              free: true,
              nosave: true,
              title: translate('torrplay_edit_username', 'Username'),
              value: instance.username || '',
            }, value => {
              instance.username = value ? value.trim() : '';
              InstanceManager.updateInstance(instance);
              this.openInstanceActions(instance);
            });
          }
        } else if (selectedItem.action === 'edit_password') {
          if (Lampa.Input) {
            Lampa.Input.edit({
              free: true,
              nosave: true,
              password: true,
              title: translate('torrplay_edit_password', 'Password'),
              value: instance.password || '',
            }, value => {
              instance.password = value ? value.trim() : '';
              InstanceManager.updateInstance(instance);
              this.openInstanceActions(instance);
            });
          }
        } else if (selectedItem.action === 'edit_storage_path') {
          if (Lampa.Input) {
            const promptEdit = (currentPath: string) => {
              Lampa.Input.edit({
                free: true,
                nosave: true,
                title: `${instance.name}: ${translate('torrplay_storage_path', 'File Storage Path')}`,
                value: currentPath,
              }, async value => {
                const newPath = value ? value.trim() : '';
                try {
                  await TorrPlayApi.updateSettings(instance, { file_storage_path: newPath });
                  instance.fileStoragePath = newPath;
                  InstanceManager.updateInstance(instance);
                  if (Lampa.Noty) {
                    Lampa.Noty.show(
                      translate('torrplay_noty_storage_updated', `Updated storage path on ${instance.name}`, {
                        name: instance.name,
                      })
                    );
                  }
                } catch (error) {
                  if (Lampa.Noty) {
                    const msg = error instanceof Error ? error.message : String(error);
                    Lampa.Noty.show(
                      translate('torrplay_noty_storage_failed', `Failed to update storage path: ${msg}`, { msg })
                    );
                  }
                }
                this.openInstanceActions(instance);
              });
            };

            if (typeof instance.fileStoragePath === 'undefined') {
              TorrPlayApi.getSettings(instance).then(settings => {
                if (settings && typeof settings.file_storage_path === 'string') {
                  instance.fileStoragePath = settings.file_storage_path;
                  InstanceManager.updateInstance(instance);
                }
                promptEdit(instance.fileStoragePath || '');
              }).catch(() => {
                promptEdit('');
              });
            } else {
              promptEdit(instance.fileStoragePath);
            }
          }
        } else if (selectedItem.action === 'toggle_downloader') {
          const nextState = !instance.enableDownloader;
          TorrPlayApi.updateSettings(instance, { enable_downloader: nextState }).then(() => {
            instance.enableDownloader = nextState;
            InstanceManager.updateInstance(instance);
            if (Lampa.Noty) {
              const notyKey = nextState ? 'torrplay_noty_downloader_enabled' : 'torrplay_noty_downloader_disabled';
              const notyFallback = `Downloader ${nextState ? 'enabled' : 'disabled'} on ${instance.name}`;
              Lampa.Noty.show(translate(notyKey, notyFallback, { name: instance.name }));
            }
            this.openInstanceActions(instance);
          }).catch((error: unknown) => {
            if (Lampa.Noty) {
              const msg = error instanceof Error ? error.message : String(error);
              Lampa.Noty.show(
                translate('torrplay_noty_downloader_failed', `Failed to update downloader: ${msg}`, { msg })
              );
            }
            this.openInstanceActions(instance);
          });
        } else if (selectedItem.action === 'delete') {
          if (InstanceManager.getInstances().length <= 1) {
            if (Lampa.Noty) {
              Lampa.Noty.show(
                translate('torrplay_noty_cannot_delete_only', 'Cannot delete the only instance in pool')
              );
            }
            this.openInstanceActions(instance);
            return;
          }
          this.confirmDeleteInstance(instance);
        } else if (selectedItem.action === 'back') {
          this.openPoolManager();
        }
      },
      title: instance.name,
    });
  }

  public static promptEditInstanceUrl(instance: TorrPlayInstance, initialValue?: string): void {
    if (typeof Lampa === 'undefined' || !Lampa.Input) return;

    const currentUrl = initialValue !== undefined ? initialValue : instance.url;

    Lampa.Input.edit({
      free: true,
      nosave: true,
      title: translate('torrplay_edit_url', 'Instance URL'),
      value: currentUrl,
    }, value => {
      const rawInput = (value || '').trim();

      // If user cancelled, cleared input, or submitted original unchanged URL
      if (!rawInput || rawInput === instance.url) {
        this.openInstanceActions(instance);
        return;
      }

      if (rawInput === 'http://' || rawInput === 'https://') {
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_valid_url', 'Enter a valid HTTP or HTTPS instance URL')
          );
        }
        this.openInstanceActions(instance);
        return;
      }

      // If user backed out on re-prompt without changing the invalid input
      if (initialValue !== undefined && rawInput === initialValue) {
        this.openInstanceActions(instance);
        return;
      }

      const cleanUrl = normalizeInstanceUrl(rawInput);
      if (!cleanUrl) {
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_valid_url', 'Enter a valid HTTP or HTTPS instance URL')
          );
        }
        this.promptEditInstanceUrl(instance, rawInput);
        return;
      }

      if (cleanUrl === instance.url) {
        this.openInstanceActions(instance);
        return;
      }

      const isDuplicate = InstanceManager.getInstances().some(
        inst => inst.id !== instance.id && inst.url === cleanUrl
      );
      if (isDuplicate) {
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_duplicate_url', 'An instance with this URL already exists')
          );
        }
        this.promptEditInstanceUrl(instance, rawInput);
        return;
      }

      instance.url = cleanUrl;
      instance.status = 'unknown';
      delete instance.latencyMs;
      delete instance.jwtToken;
      delete instance.jwtExpiresAtMs;
      delete instance.playbackToken;
      delete instance.playbackTokenExpiresAtMs;
      InstanceManager.updateInstance(instance);
      if (Lampa.Noty) {
        Lampa.Noty.show(translate('torrplay_noty_url_updated', 'Instance URL updated'));
      }

      TorrPlayApi.checkHealth(instance).then(healthResult => {
        if (Lampa.Noty) {
          if (healthResult.isOk) {
            Lampa.Noty.show(
              translate('torrplay_noty_online', `Instance online! Latency: ${healthResult.latencyMs} ms`, {
                latency: healthResult.latencyMs ?? 0,
              })
            );
          } else {
            Lampa.Noty.show(
              translate('torrplay_noty_offline_warning', 'Warning: Instance is offline or unreachable')
            );
          }
        }
      });

      this.openInstanceActions(instance);
    });
  }

  public static promptAddInstance(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Input) return;

    Lampa.Input.edit({
      free: true,
      nosave: true,
      title: translate('torrplay_instance_url_placeholder', 'Instance URL (e.g. http://192.168.1.100:8090)'),
      value: 'http://',
    }, instanceUrlInput => {
      if (!instanceUrlInput || !instanceUrlInput.trim() || instanceUrlInput.trim() === 'http://') {
        this.openPoolManager();
        return;
      }
      const normalizedUrl = normalizeInstanceUrl(instanceUrlInput);
      if (!normalizedUrl) {
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_valid_url', 'Enter a valid HTTP or HTTPS instance URL')
          );
        }
        this.openPoolManager();
        return;
      }
      const isDuplicate = InstanceManager.getInstances().some(inst => inst.url === normalizedUrl);
      if (isDuplicate) {
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_duplicate_url', 'An instance with this URL already exists')
          );
        }
        this.openPoolManager();
        return;
      }
      const parsed = new URL(normalizedUrl);
      const defaultName = parsed.hostname;

      Lampa.Input.edit({
        free: true,
        nosave: true,
        title: translate('torrplay_edit_name', 'Instance Name'),
        value: defaultName,
      }, instanceNameInput => {
        const newInst: TorrPlayInstance = {
          authType: 'none',
          id: generateUuid(),
          name: (instanceNameInput && instanceNameInput.trim()) || defaultName,
          status: 'unknown',
          url: normalizedUrl,
        };
        this.confirmAddInstance(newInst);
      });
    });
  }

  private static confirmAddInstance(instance: TorrPlayInstance): void {
    Lampa.Select.show({
      items: [
        {
          action: 'confirm_add',
          subtitle: instance.url,
          title: translate('torrplay_confirm_add_name', `Add ${instance.name}`, { name: instance.name }),
        },
        {
          action: 'cancel',
          subtitle: translate('torrplay_discard_instance', 'Discard this instance'),
          title: translate('torrplay_cancel', 'Cancel'),
        },
      ],
      onBack: () => {
        this.openPoolManager();
      },
      onSelect: (selectedItem: LampaSelectItem) => {
        if (selectedItem.action !== 'confirm_add') {
          this.openPoolManager();
          return;
        }

        InstanceManager.addInstance(instance);
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_added', `Added ${instance.name} to pool`, { name: instance.name })
          );
        }
        TorrPlayApi.checkHealth(instance).then(healthResult => {
          if (Lampa.Noty) {
            if (healthResult.isOk) {
              Lampa.Noty.show(
                translate('torrplay_noty_online', `Instance online! Latency: ${healthResult.latencyMs} ms`, {
                  latency: healthResult.latencyMs ?? 0,
                })
              );
            } else {
              Lampa.Noty.show(
                translate('torrplay_noty_offline_warning', 'Warning: Instance is offline or unreachable')
              );
            }
          }
        });
        this.openPoolManager();
      },
      title: translate('torrplay_confirm_add_title', 'Confirm Instance'),
    });
  }

  private static confirmDeleteInstance(instance: TorrPlayInstance): void {
    Lampa.Select.show({
      items: [
        {
          action: 'confirm_delete',
          subtitle: translate('torrplay_confirm_delete_descr', 'This also removes its saved credentials'),
          title: translate('torrplay_confirm_delete_name', `Delete ${instance.name}`, { name: instance.name }),
        },
        {
          action: 'cancel',
          subtitle: translate('torrplay_keep_instance', 'Keep this instance'),
          title: translate('torrplay_cancel', 'Cancel'),
        },
      ],
      onBack: () => {
        this.openInstanceActions(instance);
      },
      onSelect: (selectedItem: LampaSelectItem) => {
        if (selectedItem.action !== 'confirm_delete') {
          this.openInstanceActions(instance);
          return;
        }

        InstanceManager.removeInstance(instance.id);
        if (Lampa.Noty) {
          Lampa.Noty.show(
            translate('torrplay_noty_deleted', `Deleted ${instance.name}`, { name: instance.name })
          );
        }
        this.openPoolManager();
      },
      title: translate('torrplay_confirm_delete_title', 'Delete Instance?'),
    });
  }
}
