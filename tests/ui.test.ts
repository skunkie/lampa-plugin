// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { SavedTorrents } from '../src/engine/saved-torrents';
import { TorrPlayEngine } from '../src/engine/torrplay-engine';
import { InstanceManager } from '../src/instances/instance-manager';
import { GLOBAL_SEARCH_ENABLED_STORAGE_KEY, ProviderManager } from '../src/providers/provider-manager';
import type { TorrPlayInstance } from '../src/types/torrplay';
import { CatalogChoice } from '../src/ui/catalog-choice';
import { InstancePoolUi } from '../src/ui/instance-pool';
import { SAVE_TO_DATABASE_STORAGE_KEY } from '../src/ui/play-dialog';
import {
  PLAYBACK_MODE_STORAGE_KEY,
  SettingsUi,
  TORRPLAY_ENABLED_STORAGE_KEY,
  TORRPLAY_ICON,
  TORRPLAY_SETTINGS_COMPONENT_ID,
} from '../src/ui/settings';
import { SidebarManager } from '../src/ui/sidebar';
import {
  getNavigator,
  TORRPLAY_ACTIVE_BADGE,
  TORRPLAY_STORAGE_BADGE,
  TORRPLAY_STORAGE_BADGE_ICON,
  TORRPLAY_TORRENTS_COMPONENT_ID,
  TorrPlayTorrentsComponent,
} from '../src/ui/torrplay-torrents';

describe('UI & Settings Integration', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();
  const registeredComponents = new Map<string, any>();
  const registeredParams: any[] = [];
  const customComponents = new Map<string, any>();

  let lastSelectOptions: any = null;
  let lastInputOptions: any = null;
  let lastHeadTitle: string | null = null;

  beforeEach(() => {
    storageMap.clear();
    registeredComponents.clear();
    registeredParams.length = 0;
    customComponents.clear();
    lastSelectOptions = null;
    lastInputOptions = null;
    lastHeadTitle = null;

    (globalThis as any).Lampa = {
      Component: {
        add: (name: string, component: any) => customComponents.set(name, component),
        get: (name: string) => customComponents.get(name),
      },
      Head: {
        title: (title: string) => {
          lastHeadTitle = title;
        },
      },
      Input: {
        edit: (options: any, callback: any) => {
          lastInputOptions = options;
          callback('http://192.168.1.200:8090');
        },
      },
      Listener: {
        follow: () => {},
      },
      Noty: {
        show: () => {},
      },
      Select: {
        close: () => {},
        show: (options: any) => {
          lastSelectOptions = options;
        },
      },
      SettingsApi: {
        addComponent: (component: any) => registeredComponents.set(component.component, component),
        addParam: (parameter: any) => registeredParams.push(parameter),
        getParam: (componentId: string) => (
          registeredParams.filter(parameter => parameter.component === componentId)
        ),
      },
      Storage: {
        get: (k: string, d: any) => (storageMap.has(k) ? storageMap.get(k) : d),
        set: (k: string, v: any) => storageMap.set(k, v),
      },
      Torserver: {
        my: (_success: any, _fail: any) => {},
      },
    };

    (InstanceManager as any).isInitialized = false;
    (InstanceManager as any).instances = [];
    InstanceManager.init();
    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('registers TorrPlay settings component and pool-only parameters', () => {
    SettingsUi.init();

    assert.ok(registeredComponents.has(TORRPLAY_SETTINGS_COMPONENT_ID));
    const settingsComponent = registeredComponents.get(TORRPLAY_SETTINGS_COMPONENT_ID);
    assert.equal(settingsComponent.name, 'TorrPlay');
    assert.equal(settingsComponent.before, 'tmdb');
    assert.ok(settingsComponent.icon.includes('viewBox="0 0 24 24"'));
    assert.ok(settingsComponent.icon.includes('stroke="white"'));
    assert.ok(settingsComponent.icon.includes('fill="white"'));
    assert.ok(settingsComponent.icon.includes('fill-rule="evenodd"'));
    assert.ok(!settingsComponent.icon.includes('#00e676'));
    assert.equal(settingsComponent.icon, TORRPLAY_ICON);

    const parameterNames = registeredParams.map(parameter => parameter.param.name);
    assert.ok(parameterNames.includes(TORRPLAY_ENABLED_STORAGE_KEY));
    assert.ok(parameterNames.includes(GLOBAL_SEARCH_ENABLED_STORAGE_KEY));
    assert.ok(parameterNames.includes('torrplay_selection_mode'));
    assert.ok(parameterNames.includes('torrplay_instances_btn'));
    assert.ok(parameterNames.includes('torrplay_providers_btn'));
    assert.ok(parameterNames.includes('torrplay_about_btn'));
    assert.ok(!parameterNames.includes('torrplay_ping_btn'));
    const playbackModeParam = registeredParams.find(parameter => parameter.param.name === PLAYBACK_MODE_STORAGE_KEY);
    assert.ok(playbackModeParam);
    assert.equal(playbackModeParam.param.default, 'torrplay');
    assert.ok(!parameterNames.includes('torrplay_file_storage_path'));

    const saveToDbParam = registeredParams.find(parameter => parameter.param.name === SAVE_TO_DATABASE_STORAGE_KEY);
    assert.ok(saveToDbParam);
    assert.equal(saveToDbParam.param.default, 'false');

    // Verify button parameters use onChange without redundant onRender click handlers
    const buttonParams = registeredParams.filter(parameter => parameter.param.type === 'button');
    assert.equal(buttonParams.length, 3);
    for (const buttonParameter of buttonParams) {
      assert.equal(typeof buttonParameter.onChange, 'function');
      assert.equal(buttonParameter.onRender, undefined);
    }
  });

  it('shows plugin version and build info via the About Plugin button', () => {
    SettingsUi.init();

    const aboutButton = registeredParams.find(parameter => parameter.param.name === 'torrplay_about_btn');
    assert.ok(aboutButton && aboutButton.onChange);

    let toggledController = '';
    (globalThis as any).Lampa.Controller = {
      ...((globalThis as any).Lampa.Controller || {}),
      toggle: (name: string) => { toggledController = name; },
    };

    aboutButton.onChange();
    assert.ok(lastSelectOptions);
    assert.ok(lastSelectOptions.title.includes('About'));

    const versionItem = lastSelectOptions.items.find((i: any) => i.title === 'Version');
    assert.ok(versionItem, 'About screen must show the plugin version');
    assert.equal(typeof versionItem.subtitle, 'string');
    assert.ok(versionItem.subtitle.length > 0);

    const buildDateItem = lastSelectOptions.items.find((i: any) => i.title === 'Build Date');
    assert.ok(buildDateItem, 'About screen must show the build date');

    const commitItem = lastSelectOptions.items.find((i: any) => i.title === 'Commit');
    assert.ok(commitItem, 'About screen must show the build commit');

    const backAction = lastSelectOptions.items.find((i: any) => i.action === 'back');
    assert.ok(backAction);

    lastSelectOptions.onSelect(versionItem);
    assert.equal(toggledController, '', 'selecting an informational row must keep the About screen open');

    lastSelectOptions.onSelect(backAction);
    assert.equal(toggledController, 'settings_component', 'selecting Back must return focus to the settings component');

    toggledController = '';
    lastSelectOptions.onBack();
    assert.equal(toggledController, 'settings_component', 'onBack must return focus to the settings component');
  });

  it('opens TV-friendly instance pool manager via Lampa.Select', () => {
    SettingsUi.init();

    const poolButton = registeredParams.find(parameter => parameter.param.name === 'torrplay_instances_btn');
    assert.ok(poolButton && poolButton.onChange);

    poolButton.onChange();
    assert.ok(lastSelectOptions);
    assert.ok(lastSelectOptions.title.includes('TorrPlay Pool'));
    assert.ok(lastSelectOptions.items.length >= 4); // Add instance, Test all, at least 1 instance, and Back
    assert.equal(typeof lastSelectOptions.onBack, 'function');

    const backAction = lastSelectOptions.items.find((i: any) => i.action === 'back');
    assert.ok(backAction);
    assert.ok(backAction.title.includes('Back'));

    const addAction = lastSelectOptions.items.find((i: any) => i.action === 'add');
    assert.ok(addAction);
    assert.ok(addAction.title.includes('Add Instance'));

    const instanceItem = lastSelectOptions.items.find((i: any) => i.action === 'instance');
    assert.ok(instanceItem);

    // Open instance actions
    lastSelectOptions.onSelect(instanceItem);
    assert.ok(lastSelectOptions);
    assert.equal(lastSelectOptions.title, instanceItem.data.name);

    const actionNames = lastSelectOptions.items.map((i: any) => i.action);
    assert.ok(!actionNames.includes('select'));
    assert.ok(actionNames.includes('test'));
    assert.ok(actionNames.includes('edit_name'));
    assert.ok(actionNames.includes('edit_url'));
    assert.ok(actionNames.includes('edit_auth'));
    assert.ok(actionNames.includes('edit_storage_path'));
    assert.ok(actionNames.includes('toggle_downloader'));
    assert.ok(!actionNames.includes('toggle_enabled'));
    assert.ok(actionNames.includes('delete'));
    assert.ok(actionNames.includes('back'));

    // Re-open pool menu and test add instance action triggers input
    poolButton.onChange();
    const addInstanceBtn = lastSelectOptions.items.find((i: any) => i.action === 'add');
    assert.ok(addInstanceBtn);
    lastSelectOptions.onSelect(addInstanceBtn);
    assert.ok(lastInputOptions);
    assert.equal(lastInputOptions.title, 'Instance Name');
  });

  it('displays active instance indicators in the pool list across modes', () => {
    const instances = InstanceManager.getInstances();
    const firstInstance = instances[0];
    const secondInstance: TorrPlayInstance = {
      authType: 'none',
      id: 'inst-2',
      name: 'Second Node',
      url: 'http://second.local:8090',
    };
    InstanceManager.addInstance(secondInstance);

    // 1. Manual mode
    InstanceManager.setMode('manual');
    InstanceManager.setSelectedId(firstInstance.id);

    InstancePoolUi.openPoolManager();
    const firstItem = lastSelectOptions.items.find((item: any) => item.action === 'instance' && item.data.id === firstInstance.id);
    const secondItem = lastSelectOptions.items.find((item: any) => item.action === 'instance' && item.data.id === secondInstance.id);
    assert.ok(firstItem.title.includes('[Active]'));
    assert.equal(firstItem.selected, true);
    assert.equal(secondItem.title.includes('[Active]'), false);
    assert.equal(secondItem.selected, false);

    // "Change Active Instance" is only offered in manual mode
    const setActiveAction = lastSelectOptions.items.find((item: any) => item.action === 'set_active');
    assert.ok(setActiveAction);

    // 2. Auto mode
    InstanceManager.setMode('auto');
    firstInstance.status = 'online';
    firstInstance.latencyMs = 20;
    secondInstance.status = 'online';
    secondInstance.latencyMs = 80;
    InstanceManager.updateInstance(firstInstance);
    InstanceManager.updateInstance(secondInstance);

    InstancePoolUi.openPoolManager();
    const autoFirstItem = lastSelectOptions.items.find((item: any) => item.action === 'instance' && item.data.id === firstInstance.id);
    assert.ok(autoFirstItem.title.includes('[Active (Auto)]'));
    assert.equal(autoFirstItem.selected, true);
    assert.ok(!lastSelectOptions.items.some((item: any) => item.action === 'set_active'));

    InstanceManager.removeInstance(secondInstance.id);
  });

  it('picks the active instance via promptSelectActiveInstance', () => {
    const instances = InstanceManager.getInstances();
    const firstInstance = instances[0];
    const secondInstance: TorrPlayInstance = {
      authType: 'none',
      id: 'inst-2',
      name: 'Second Node',
      url: 'http://second.local:8090',
    };
    InstanceManager.addInstance(secondInstance);

    InstanceManager.setMode('manual');
    InstanceManager.setSelectedId(firstInstance.id);

    InstancePoolUi.promptSelectActiveInstance();
    assert.equal(lastSelectOptions.title, 'Select Active Instance');
    const activeItem = lastSelectOptions.items.find((item: any) => item.data.id === firstInstance.id);
    const inactiveItem = lastSelectOptions.items.find((item: any) => item.data.id === secondInstance.id);
    assert.ok(activeItem.title.includes('[Active]'));
    assert.equal(activeItem.selected, true);
    assert.equal(inactiveItem.selected, false);

    lastSelectOptions.onSelect(inactiveItem);
    assert.equal(InstanceManager.getSelectedId(), secondInstance.id);

    InstanceManager.removeInstance(secondInstance.id);
  });

  it('switching Instance Pool Selection to manual opens the active instance picker', () => {
    SettingsUi.init();

    const selectionModeParam = registeredParams.find(parameter => parameter.param.name === 'torrplay_selection_mode');
    assert.ok(selectionModeParam && selectionModeParam.onChange);

    lastSelectOptions = null;
    selectionModeParam.onChange('auto');
    assert.equal(InstanceManager.getMode(), 'auto');
    assert.equal(lastSelectOptions === null, true);

    selectionModeParam.onChange('manual');
    assert.equal(InstanceManager.getMode(), 'manual');
    assert.ok(lastSelectOptions);
    assert.equal(lastSelectOptions.title, 'Select Active Instance');
  });

  it('masks passwords in the native Lampa input', () => {
    const instance = InstanceManager.getInstances()[0];
    instance.authType = 'basic';
    instance.password = 'secret';
    (globalThis as any).Lampa.Input.edit = (options: any) => {
      lastInputOptions = options;
    };

    InstancePoolUi.openInstanceActions(instance);
    const passwordAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_password');
    lastSelectOptions.onSelect(passwordAction);

    assert.equal(lastInputOptions.password, true);
    assert.equal(lastInputOptions.value, 'secret');
  });

  it('edits file storage path in instance actions and updates TorrPlay instance', async () => {
    const instance = InstanceManager.getInstances()[0];
    instance.fileStoragePath = '/initial/path';
    let patchedBody = '';
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/settings')) {
        if (init?.method === 'PATCH') {
          patchedBody = String(init.body || '');
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ file_storage_path: '/initial/path' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      return new Response(null, { status: 200 });
    };

    (globalThis as any).Lampa.Input.edit = (options: any, callback: any) => {
      lastInputOptions = options;
      callback('/new/storage/path');
    };

    InstancePoolUi.openInstanceActions(instance);
    const storagePathAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_storage_path');
    assert.ok(storagePathAction);
    assert.ok(storagePathAction.subtitle.includes('/initial/path'));

    lastSelectOptions.onSelect(storagePathAction);
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(lastInputOptions.value, '/initial/path');
    assert.equal(instance.fileStoragePath, '/new/storage/path');
    assert.equal(patchedBody, JSON.stringify({ file_storage_path: '/new/storage/path' }));
  });

  it('toggles enable downloader in instance actions and updates TorrPlay instance', async () => {
    const instance = InstanceManager.getInstances()[0];
    instance.enableDownloader = false;
    let patchedBody = '';
    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => { notyMessages.push(msg); };

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/v1/settings') && init?.method === 'PATCH') {
        patchedBody = String(init.body || '');
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 200 });
    };

    InstancePoolUi.openInstanceActions(instance);
    const downloaderAction = lastSelectOptions.items.find((item: any) => item.action === 'toggle_downloader');
    assert.ok(downloaderAction);
    assert.ok(downloaderAction.subtitle.includes('Disabled'));
    assert.ok(downloaderAction.title.includes('Enable Downloader'));

    // Toggle to enabled
    lastSelectOptions.onSelect(downloaderAction);
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(patchedBody, JSON.stringify({ enable_downloader: true }));
    assert.equal(instance.enableDownloader, true);
    assert.ok(notyMessages.some(msg => msg.includes('enabled')));

    // Re-verify menu shows Enabled and title changes to Disable Downloader
    const updatedAction = lastSelectOptions.items.find((item: any) => item.action === 'toggle_downloader');
    assert.ok(updatedAction);
    assert.ok(updatedAction.subtitle.includes('Enabled'));
    assert.ok(updatedAction.title.includes('Disable Downloader'));

    // Toggle back to disabled
    lastSelectOptions.onSelect(updatedAction);
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(patchedBody, JSON.stringify({ enable_downloader: false }));
    assert.equal(instance.enableDownloader, false);
    assert.ok(notyMessages.some(msg => msg.includes('disabled')));
  });

  it('requires confirmation before adding an instance and lets Back cancel', () => {
    const before = InstanceManager.getInstances().length;
    const values = ['http://bedroom.local:8090', 'Bedroom'];
    (globalThis as any).Lampa.Input.edit = (options: any, callback: any) => {
      lastInputOptions = options;
      callback(values.shift());
    };

    InstancePoolUi.promptAddInstance();

    assert.equal(lastSelectOptions.title, 'Confirm Instance');
    assert.equal(InstanceManager.getInstances().length, before);
    lastSelectOptions.onBack();
    assert.equal(InstanceManager.getInstances().length, before);
  });

  it('rejects invalid instance URLs when adding and editing', () => {
    const instance = InstanceManager.getInstances()[0];
    const originalUrl = instance.url;
    const before = InstanceManager.getInstances().length;
    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => { notyMessages.push(msg); };

    // 1. Invalid protocol
    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback('ftp://invalid.local');
    };

    InstancePoolUi.promptAddInstance();
    assert.equal(InstanceManager.getInstances().length, before);
    assert.ok(notyMessages.includes('Enter a valid HTTP or HTTPS instance URL'));

    InstancePoolUi.openInstanceActions(instance);
    const editUrlAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_url');
    lastSelectOptions.onSelect(editUrlAction);
    assert.equal(instance.url, originalUrl);

    // 2. Empty string
    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback('');
    };
    lastSelectOptions.onSelect(editUrlAction);
    assert.equal(instance.url, originalUrl);

    // 3. Just whitespace
    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback('   ');
    };
    lastSelectOptions.onSelect(editUrlAction);
    assert.equal(instance.url, originalUrl);

    // 4. Incomplete scheme http://
    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback('http://');
    };
    lastSelectOptions.onSelect(editUrlAction);
    assert.equal(instance.url, originalUrl);
  });

  it('normalizes valid URL on edit, strips trailing slashes, and clears stale benchmarks', () => {
    const instance = InstanceManager.getInstances()[0];
    instance.status = 'online';
    instance.latencyMs = 42;
    instance.playbackToken = 'old-token';
    instance.jwtToken = 'old-jwt';

    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => { notyMessages.push(msg); };

    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback('192.168.1.150:8090///');
    };

    InstancePoolUi.openInstanceActions(instance);
    const editUrlAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_url');
    lastSelectOptions.onSelect(editUrlAction);

    assert.equal(instance.url, 'http://192.168.1.150:8090');
    assert.equal(instance.status, 'unknown');
    assert.equal(instance.latencyMs, undefined);
    assert.equal(instance.playbackToken, undefined);
    assert.equal(instance.jwtToken, undefined);
    assert.ok(notyMessages.includes('Instance URL updated'));
  });

  it('allows correcting typos via re-prompting with previous input when URL is invalid', () => {
    const instance = InstanceManager.getInstances()[0];
    const originalUrl = instance.url;
    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => { notyMessages.push(msg); };

    const inputs = ['http://typo:invalid-port', 'http://fixed.local:8090'];
    const presentedValues: string[] = [];

    (globalThis as any).Lampa.Input.edit = (options: any, callback: any) => {
      presentedValues.push(options.value);
      callback(inputs.shift());
    };

    InstancePoolUi.openInstanceActions(instance);
    const editUrlAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_url');
    lastSelectOptions.onSelect(editUrlAction);

    assert.equal(presentedValues[0], originalUrl);
    assert.equal(presentedValues[1], 'http://typo:invalid-port');
    assert.equal(instance.url, 'http://fixed.local:8090');
    assert.ok(notyMessages.includes('Enter a valid HTTP or HTTPS instance URL'));
    assert.ok(notyMessages.includes('Instance URL updated'));
  });

  it('shows warning notification when edited instance is offline or unreachable', async () => {
    const instance = InstanceManager.getInstances()[0];
    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => { notyMessages.push(msg); };

    // Network failure on health check
    globalThis.fetch = async () => {
      throw new Error('Connection refused');
    };

    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback('http://unreachable-host.local:8090');
    };

    InstancePoolUi.openInstanceActions(instance);
    const editUrlAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_url');
    lastSelectOptions.onSelect(editUrlAction);

    // Wait for health check promise
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.equal(instance.url, 'http://unreachable-host.local:8090');
    assert.ok(notyMessages.includes('Warning: Instance is offline or unreachable'));
  });

  it('rejects duplicate URLs when adding or editing an instance', () => {
    const instances = InstanceManager.getInstances();
    const firstInstance = instances[0];
    const secondInstance = {
      authType: 'none' as const,
      id: 'second-inst',
      name: 'Second Instance',
      url: 'http://second.local:8090',
    };
    InstanceManager.addInstance(secondInstance);

    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => { notyMessages.push(msg); };

    // Try to edit secondInstance to firstInstance.url
    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback(firstInstance.url);
    };

    InstancePoolUi.openInstanceActions(secondInstance);
    const editUrlAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_url');
    lastSelectOptions.onSelect(editUrlAction);

    assert.equal(secondInstance.url, 'http://second.local:8090');
    assert.ok(notyMessages.includes('An instance with this URL already exists'));

    // Try to add an instance with already existing URL
    const beforeCount = InstanceManager.getInstances().length;
    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback(firstInstance.url);
    };
    InstancePoolUi.promptAddInstance();
    assert.equal(InstanceManager.getInstances().length, beforeCount);

    InstanceManager.removeInstance(secondInstance.id);
  });

  it('keeps instance URL unchanged without error when user cancels or submits identical URL', () => {
    const instance = InstanceManager.getInstances()[0];
    const originalUrl = instance.url;
    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => { notyMessages.push(msg); };

    (globalThis as any).Lampa.Input.edit = (_options: any, callback: any) => {
      callback(originalUrl);
    };

    InstancePoolUi.openInstanceActions(instance);
    const editUrlAction = lastSelectOptions.items.find((item: any) => item.action === 'edit_url');
    lastSelectOptions.onSelect(editUrlAction);

    assert.equal(instance.url, originalUrl);
    assert.equal(notyMessages.length, 0);
  });

  it('requires confirmation before deleting an instance', () => {
    const removable = {
      authType: 'none' as const,
      id: 'removable',
      name: 'Removable',
      url: 'http://removable.local:8090',
    };
    InstanceManager.addInstance(removable);

    InstancePoolUi.openInstanceActions(removable);
    const deleteAction = lastSelectOptions.items.find((item: any) => item.action === 'delete');
    lastSelectOptions.onSelect(deleteAction);

    assert.equal(lastSelectOptions.title, 'Delete Instance?');
    assert.ok(InstanceManager.getInstances().some(instance => instance.id === removable.id));
    const confirmAction = lastSelectOptions.items.find((item: any) => item.action === 'confirm_delete');
    lastSelectOptions.onSelect(confirmAction);
    assert.ok(!InstanceManager.getInstances().some(instance => instance.id === removable.id));
  });

  it('registers TorrPlay Torrents component', () => {
    (SidebarManager as any).isRegistered = false;
    SidebarManager.init();

    assert.ok(customComponents.has(TORRPLAY_TORRENTS_COMPONENT_ID));
  });

  function makeMenuJqMock(menuItems: Array<{ dataAction?: string, label: string }>) {
    function makeWrapper(indices: number[]): any {
      const wrapper: any = {
        after: (newItemWrapper: any) => {
          menuItems.splice(indices[0] + 1, 0, newItemWrapper.__item);
        },
        append: (newItemWrapper: any) => {
          menuItems.push(newItemWrapper.__item);
        },
        children: () => makeWrapper(menuItems.map((_item, index) => index)),
        find: (sel: string) => {
          if (sel.includes('menu__text')) {
            return { text: () => (indices.length ? menuItems[indices[0]].label : '') };
          }
          const match = sel.match(/data-action="([^"]+)"/);
          const foundIndex = match ? menuItems.findIndex(item => item.dataAction === match[1]) : -1;
          return makeWrapper(foundIndex === -1 ? [] : [foundIndex]);
        },
        first: () => makeWrapper(indices.length ? [indices[0]] : []),
        length: indices.length,
        on: () => wrapper,
      };
      return wrapper;
    }

    return (selectorOrHtml: string) => {
      if (selectorOrHtml.trim().startsWith('<')) {
        const dataActionMatch = selectorOrHtml.match(/data-action="([^"]+)"/);
        const labelMatch = selectorOrHtml.match(/menu__text">([^<]*)</);
        const wrapper = makeWrapper([]);
        wrapper.__item = { dataAction: dataActionMatch ? dataActionMatch[1] : undefined, label: labelMatch ? labelMatch[1] : '' };
        return wrapper;
      }
      if (selectorOrHtml.includes('torrplay')) {
        const foundIndex = menuItems.findIndex(item => item.dataAction === 'torrplay');
        return makeWrapper(foundIndex === -1 ? [] : [foundIndex]);
      }
      if (selectorOrHtml.includes('menu__list')) {
        return makeWrapper([0]); // Represents the list container itself (exists = length 1).
      }
      return makeWrapper([]);
    };
  }

  it('positions the TorrPlay sidebar entry as the second menu item and registers it in Lampa\'s persisted menu order', () => {
    // Realistic starting state: Lampa's own menu editor has already auto-recorded
    // the native items into 'menu_sort' from earlier sessions, before TorrPlay
    // was ever installed.
    storageMap.set('menu_sort', ['Home', 'Search', 'Torrents']);

    const menuItems = [
      { dataAction: 'home', label: 'Home' },
      { dataAction: 'search', label: 'Search' },
      { dataAction: 'mytorrents', label: 'Torrents' },
    ];
    (globalThis as any).$ = makeMenuJqMock(menuItems);

    let appListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'app') appListener = callback;
      },
    };

    (SidebarManager as any).isRegistered = false;
    SidebarManager.init();
    assert.ok(appListener, 'app listener must be registered');

    appListener({ type: 'ready' });

    assert.deepEqual(menuItems.map(item => item.dataAction), ['home', 'torrplay', 'search', 'mytorrents']);

    // Lampa's own menu editor (interaction/menu/menu.js + editor.js) persists a custom
    // item order under 'menu_sort' and re-appends anything not already in it to the
    // end — silently dragging a brand-new item to the bottom regardless of DOM
    // position. Registering it ourselves, right after the anchor item, prevents that.
    assert.deepEqual(storageMap.get('menu_sort'), ['Home', 'TorrPlay', 'Search', 'Torrents']);
  });

  it('corrects a stale bottom-of-list menu_sort entry from before this fix existed', () => {
    storageMap.set('menu_sort', ['Home', 'Search', 'Torrents', 'TorrPlay']);

    const menuItems = [
      { dataAction: 'home', label: 'Home' },
      { dataAction: 'search', label: 'Search' },
      { dataAction: 'mytorrents', label: 'Torrents' },
    ];
    (globalThis as any).$ = makeMenuJqMock(menuItems);

    let appListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'app') appListener = callback;
      },
    };

    (SidebarManager as any).isRegistered = false;
    SidebarManager.init();
    appListener({ type: 'ready' });

    assert.deepEqual(storageMap.get('menu_sort'), ['Home', 'TorrPlay', 'Search', 'Torrents']);
  });

  it('does not insert prematurely (and permanently at the bottom) when the menu list is not yet populated', () => {
    // Simulates native items (Home, Search, ...) not having been added to the DOM yet
    // when the first trigger fires — a real timing race, since Lampa populates them
    // asynchronously via separate init calls. 'menu_sort' is pre-seeded the same way
    // as a realistic returning user (Lampa's own menu editor already recorded the
    // native items in earlier sessions).
    storageMap.set('menu_sort', ['Home', 'Search', 'Torrents']);
    const menuItems: Array<{ dataAction?: string, label: string }> = [];
    (globalThis as any).$ = makeMenuJqMock(menuItems);

    let appListener: any = null;
    let menuListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'app') appListener = callback;
        if (event === 'menu') menuListener = callback;
      },
    };

    (SidebarManager as any).isRegistered = false;
    SidebarManager.init();

    // First trigger: menu list is still empty — must not insert anything, and
    // critically must NOT append (which would strand it at the bottom forever).
    appListener({ type: 'ready' });
    assert.equal(menuItems.length, 0);

    // Native items arrive asynchronously afterward.
    menuItems.push(
      { dataAction: 'home', label: 'Home' },
      { dataAction: 'search', label: 'Search' },
      { dataAction: 'mytorrents', label: 'Torrents' }
    );

    // A later retrigger (e.g. the user opening the menu) must now succeed and land
    // TorrPlay as the second item, not appended at the end.
    menuListener({ type: 'start' });
    assert.deepEqual(menuItems.map(item => item.dataAction), ['home', 'torrplay', 'search', 'mytorrents']);
    assert.deepEqual(storageMap.get('menu_sort'), ['Home', 'TorrPlay', 'Search', 'Torrents']);
  });

  it('manages TorrPlayTorrentsComponent lifecycle (create, render, start, pause, stop, destroy)', async () => {
    let activeController = '';
    const controllers = new Map<string, any>();

    const createMockElement = (tag: string) => {
      const children: any[] = [];
      const el: any = {
        0: { tagName: tag.startsWith('<') ? 'DIV' : tag.toUpperCase() },
        addClass: () => el,
        append: (child: any) => {
          children.push(child);
          return el;
        },
        attr: (_k: string, _v?: string) => el,
        children,
        empty: () => {
          children.length = 0;
          return el;
        },
        find: (_sel: string) => el,
        htmlString: tag,
        on: (_evt: string, _cb: any) => el,
        remove: () => el,
        removeClass: () => el,
        text: (_t?: string) => el,
      };
      return el;
    };

    class MockScroll {
      public append(_elem: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public nopadding() {}
      public render(_js?: boolean) {
        return createMockElement('div');
      }
      public reset() {}
      public update() {}
    }

    class MockEmpty {
      public render() {
        return createMockElement('div');
      }
    }

    globalThis.fetch = async () => new Response(JSON.stringify({
      torrents: [],
      total: 0,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

    (globalThis as any).$ = (tag: string) => createMockElement(tag);
    (globalThis as any).Lampa.Activity = {
      backward: () => {},
    };
    (globalThis as any).Lampa.Background = {
      change: () => {},
    };
    (globalThis as any).Lampa.Controller = {
      add: (name: string, ctrl: any) => controllers.set(name, ctrl),
      collectionFocus: () => {},
      collectionSet: () => {},
      enabled: () => ({ name: activeController }),
      toggle: (name: string) => {
        activeController = name;
      },
    };
    (globalThis as any).Lampa.Empty = MockEmpty;
    (globalThis as any).Lampa.Navigator = {
      canmove: () => true,
      move: () => {},
    };
    (globalThis as any).Lampa.Scroll = MockScroll;
    (globalThis as any).Lampa.Utils = {
      bytesToSize: (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`,
      clearHtmlTags: (value: string) => value,
    };

    (SidebarManager as any).isRegistered = false;
    SidebarManager.init();

    const ComponentClass = customComponents.get(TORRPLAY_TORRENTS_COMPONENT_ID);
    assert.ok(ComponentClass);

    const component = new ComponentClass();
    assert.ok(component.contentGrid.htmlString.includes('class="mapping--grid cols--6"'));
    assert.equal(typeof component.create, 'function');
    assert.equal(typeof component.render, 'function');
    assert.equal(typeof component.start, 'function');
    assert.equal(typeof component.pause, 'function');
    assert.equal(typeof component.stop, 'function');
    assert.equal(typeof component.destroy, 'function');

    const domElement = component.create();
    assert.ok(domElement);
    // create() fires load() in the background; yield once so it can start, then wait for it to complete.
    await new Promise(resolve => setImmediate(resolve));
    while ((component as any).isLoading) {
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.ok(component.render(true));
    assert.ok(component.render(false));

    component.start();
    assert.ok(controllers.has('content'));
    assert.equal(activeController, 'content');

    // Test getNavigator resolution
    const originalGlobalNavigator = (globalThis as any).Navigator;
    try {
      (globalThis as any).Navigator = { move: () => {} };
      assert.equal(getNavigator(), (globalThis as any).Navigator);

      delete (globalThis as any).Navigator;
      (globalThis as any).window = { Navigator: { move: () => {} } };
      assert.equal(getNavigator(), (globalThis as any).window.Navigator);

      (globalThis as any).window = {};
      (globalThis as any).Lampa.Navigator = { move: () => {} };
      assert.equal(getNavigator(), (globalThis as any).Lampa.Navigator);
    } finally {
      (globalThis as any).Navigator = originalGlobalNavigator;
    }

    // Test controller directional callbacks
    const contentController = controllers.get('content');
    assert.ok(contentController);

    let isBackwardCalled = false;
    (globalThis as any).Lampa.Activity.backward = () => {
      isBackwardCalled = true;
    };
    let canMoveLeft = true;
    let canMoveUp = true;
    let movedDirection = '';
    (globalThis as any).Lampa.Navigator = {
      canmove: (direction: string) => {
        if (direction === 'left') return canMoveLeft;
        if (direction === 'up') return canMoveUp;
        return true;
      },
      move: (direction: string) => {
        movedDirection = direction;
      },
    };

    contentController.back();
    assert.equal(isBackwardCalled, true);

    contentController.right();
    assert.equal(movedDirection, 'right');

    contentController.down();
    assert.equal(movedDirection, 'down');

    contentController.left();
    assert.equal(movedDirection, 'left');

    canMoveLeft = false;
    contentController.left();
    assert.equal(activeController, 'menu');

    contentController.up();
    assert.equal(movedDirection, 'up');

    canMoveUp = false;
    contentController.up();
    assert.equal(activeController, 'head');

    contentController.toggle();
    assert.equal(activeController, 'head');

    component.pause();
    component.stop();
    component.destroy();
  });

  it('displays the active instance name and re-resolves it after pausing and resuming', async () => {
    const createMockElement = (tag: string) => {
      const children: any[] = [];
      let textContent = '';
      const el: any = {
        0: { tagName: tag.startsWith('<') ? 'DIV' : tag.toUpperCase() },
        addClass: () => el,
        append: (child: any) => { children.push(child); return el; },
        attr: (_k: string, _v?: string) => el,
        children,
        empty: () => { children.length = 0; return el; },
        find: (_sel: string) => el,
        htmlString: tag,
        on: (_evt: string, _cb: any) => el,
        remove: () => el,
        removeClass: () => el,
        text: (t?: string) => {
          if (t === undefined) return textContent;
          textContent = t;
          return el;
        },
      };
      return el;
    };

    const controllers = new Map<string, any>();
    (globalThis as any).$ = (tag: string) => createMockElement(tag);
    (globalThis as any).Lampa.Controller = {
      add: (name: string, ctrl: any) => controllers.set(name, ctrl),
      collectionFocus: () => {},
      collectionSet: () => {},
      enabled: () => ({ name: 'content' }),
      toggle: () => {},
    };
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return createMockElement('div'); }
      public reset() {}
      public update() {}
    };
    (globalThis as any).Lampa.Utils = {
      bytesToSize: (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`,
      clearHtmlTags: (value: string) => value,
    };
    (globalThis as any).Lampa.Empty = class {
      public render() { return createMockElement('div'); }
    };

    const instanceA = { authType: 'none', id: 'a', name: 'Instance A', status: 'unknown', url: 'http://a.local:8090' };
    const instanceB = { authType: 'none', id: 'b', name: 'Instance B', status: 'unknown', url: 'http://b.local:8090' };
    (InstanceManager as any).instances = [instanceA, instanceB];
    storageMap.set('torrplay_selection_mode', 'manual');
    storageMap.set('torrplay_selected_instance', 'a');

    globalThis.fetch = async () => new Response(JSON.stringify({ torrents: [], total: 0 }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

    const component = new TorrPlayTorrentsComponent();
    component.create();
    await new Promise(resolve => setImmediate(resolve));
    while ((component as any).isLoading) {
      await new Promise(resolve => setImmediate(resolve));
    }

    assert.equal(
      lastHeadTitle,
      'TorrPlay (Instance A)',
      'header title must show the initially active instance'
    );

    // Register the 'content' controller and start polling, matching real activation.
    component.start();
    assert.ok((component as any).pollIntervalId !== null, 'polling must be active after start()');

    // Switch the active instance, mirroring what happens when the user changes it in Settings.
    storageMap.set('torrplay_selected_instance', 'b');

    // Returning from Settings pauses (rather than stops) the underlying component; without
    // marking it for reload, resuming would keep showing the previous instance's torrents.
    component.pause();
    assert.equal((component as any).needsReload, true, 'pausing must mark the component for reload');
    assert.equal((component as any).pollIntervalId, null, 'polling must stop while paused');

    // Simulate Lampa re-focusing this screen's already-registered controller on return, without
    // necessarily calling start() again — this is the path the controller's own toggle callback
    // (not start()'s needsReload branch) is responsible for.
    const contentController = controllers.get('content');
    assert.ok(contentController, 'content controller must have been registered by start()');
    contentController.toggle();
    await new Promise(resolve => setImmediate(resolve));
    while ((component as any).isLoading) {
      await new Promise(resolve => setImmediate(resolve));
    }

    assert.equal(
      lastHeadTitle,
      'TorrPlay (Instance B)',
      'header title must switch to the newly active instance after resuming'
    );
    assert.ok(
      (component as any).pollIntervalId !== null,
      'polling must resume after reloading on resume, not just reload once'
    );

    component.stop();
    component.destroy();
  });

  it('renders user-friendly formatted empty states for unreachable instances and connection errors', async () => {
    let lastEmptyParams: any = null;
    class MockEmpty {
      constructor(params?: any) {
        lastEmptyParams = params;
      }
      public render() {
        return { 0: { tagName: 'DIV' }, append: () => {}, empty: () => {} };
      }
    }
    const createMockElement = (tag: string) => {
      const children: any[] = [];
      const el: any = {
        0: { tagName: tag.startsWith('<') ? 'DIV' : tag.toUpperCase() },
        addClass: () => el,
        append: (child: any) => {
          children.push(child);
          return el;
        },
        attr: (_k: string, _v?: string) => el,
        children,
        empty: () => {
          children.length = 0;
          return el;
        },
        find: (_sel: string) => el,
        htmlString: tag,
        on: (_evt: string, _cb: any) => el,
        remove: () => el,
        removeClass: () => el,
        text: (_t?: string) => el,
      };
      return el;
    };

    let clearCalls = 0;
    let nopaddingCalls = 0;
    let resetCalls = 0;

    class MockScroll {
      public append(_elem: any) {}
      public clear() {
        clearCalls++;
      }
      public destroy() {}
      public minus() {}
      public nopadding() {
        nopaddingCalls++;
      }
      public render() {
        return createMockElement('div');
      }
      public reset() {
        resetCalls++;
      }
      public update() {}
    }

    (globalThis as any).$ = (tag: string) => createMockElement(tag);
    (globalThis as any).Lampa.Empty = MockEmpty;
    (globalThis as any).Lampa.Scroll = MockScroll;

    const originalGetBest = InstanceManager.getBestInstance;
    try {
      // 1. Unreachable instances error
      InstanceManager.getBestInstance = async () => {
        throw new Error('All configured TorrPlay instances are unreachable');
      };
      const component = new TorrPlayTorrentsComponent();
      await component.load();
      assert.ok(lastEmptyParams);
      assert.equal(lastEmptyParams.title, 'TorrPlay: Instances Unreachable');
      assert.ok(lastEmptyParams.descr.includes('All configured TorrPlay instances are unreachable'));
      assert.ok(lastEmptyParams.descr.includes('Settings → TorrPlay → Manage Instance Pool'));
      assert.ok(clearCalls > 0, 'scrollView.clear should be called');
      assert.ok(nopaddingCalls > 0, 'scrollView.nopadding should be called');
      assert.ok(resetCalls > 0, 'scrollView.reset should be called');

      // 2. No instances configured error
      InstanceManager.getBestInstance = async () => {
        throw new Error('No TorrPlay instances configured');
      };
      await component.load();
      assert.equal(lastEmptyParams.title, 'TorrPlay: No Instances Configured');
      assert.ok(lastEmptyParams.descr.includes('No TorrPlay instances are configured'));
      assert.ok(lastEmptyParams.descr.includes('Settings → TorrPlay → Manage Instance Pool'));

      // 3. Generic connection error
      InstanceManager.getBestInstance = async () => {
        throw new Error('Network timeout (ETIMEDOUT)');
      };
      await component.load();
      assert.equal(lastEmptyParams.title, 'TorrPlay: Connection Error');
      assert.ok(lastEmptyParams.descr.includes('Unable to load database torrents: Network timeout (ETIMEDOUT)'));
    } finally {
      InstanceManager.getBestInstance = originalGetBest;
    }
  });

  it('renders torrent cards matching native Lampa Torrents card styling', () => {
    const createMockElement = (tag: any) => {
      if (tag && typeof tag === 'object') {
        return tag;
      }
      const tagStr = typeof tag === 'string' ? tag : 'div';
      const children: any[] = [];
      const events: string[] = [];
      const el: any = {
        0: { tagName: tagStr.startsWith('<') ? 'DIV' : tagStr.toUpperCase() },
        addClass: (_cls: string) => el,
        append: (child: any) => {
          children.push(child);
          return el;
        },
        attr: (_k: string, _v?: string) => el,
        children,
        empty: () => {
          children.length = 0;
          return el;
        },
        events,
        find: (_sel: string) => el,
        htmlString: tagStr,
        on: (eventName: string, _callback: any) => {
          events.push(eventName);
          return el;
        },
        remove: () => el,
        removeClass: (_cls?: string) => el,
        text: (_t?: string) => el,
      };
      return el;
    };

    class MockScroll {
      public append(_elem: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public nopadding() {}
      public render(_js?: boolean) {
        return createMockElement('div');
      }
      public reset() {}
      public update() {}
    }

    class MockEmpty {
      public render() {
        return createMockElement('div');
      }
    }

    globalThis.fetch = async () => new Response(JSON.stringify({
      torrents: [],
      total: 0,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

    (globalThis as any).$ = (tag: string) => createMockElement(tag);
    (globalThis as any).Lampa.Background = {
      change: () => {},
    };
    let isCollectionFocusCalled = false;
    let isCollectionSetCalled = false;
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {
        isCollectionFocusCalled = true;
      },
      collectionSet: () => {
        isCollectionSetCalled = true;
      },
    };
    (globalThis as any).Lampa.Empty = MockEmpty;
    (globalThis as any).Lampa.Scroll = MockScroll;
    (globalThis as any).Lampa.Utils = {
      bytesToSize: (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`,
      clearHtmlTags: (value: string) => value,
    };

    (SidebarManager as any).isRegistered = false;
    SidebarManager.init();

    const ComponentClass = customComponents.get(TORRPLAY_TORRENTS_COMPONENT_ID);
    assert.ok(ComponentClass);

    const component = new ComponentClass();
    // Avoid triggering async load() which leaks into the next test;
    // set up the scroll/body the same way create() would, then call renderTorrents() directly.
    component.scrollView.minus();
    component.scrollView.append(component.contentGrid);
    component.rootElement.append(component.scrollView.render());

    const sampleTorrents = [
      {
        files: [{ length: 1048576, name: 'movie.mkv', path: 'movie.mkv' }],
        hash: 'abc123456789',
        name: 'Big Buck Bunny (2008)',
        poster: 'https://example.com/poster.jpg',
        storage: 'memory',
        title: 'Big Buck Bunny',
        total_size: 1048576,
      },
      {
        active: true,
        files: [
          { length: 1048576, name: 'video-1.mp4', path: 'video-1.mp4' },
          { length: 1048576, name: 'video-2.mp4', path: 'video-2.mp4' },
        ],
        hash: 'def987654321',
        name: 'Elephants Dream (2006)',
        storage: 'file',
        total_size: 2097152,
      },
      {
        files: [],
        hash: 'empty12345678',
        name: 'Empty Torrent',
        storage: 'memory',
        total_size: 0,
      },
      {
        files: [
          { length: 1048576, name: 'part-1.mkv', path: 'part-1.mkv' },
          { length: 1048576, name: 'part-2.mkv', path: 'part-2.mkv' },
          { length: 1048576, name: 'part-3.mkv', path: 'part-3.mkv' },
        ],
        hash: 'unknown123456',
        name: 'Unknown Storage',
        storage: 'cache',
        total_size: 3145728,
      },
    ];

    component.renderTorrents(sampleTorrents, {
      authType: 'none',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    });
    assert.equal(component.contentGrid.children.length, 4);

    const firstCardHtml = component.contentGrid.children[0].htmlString;
    assert.ok(component.contentGrid.children[0].events.includes('hover:enter'));
    assert.ok(component.contentGrid.children[0].events.includes('hover:long'));
    assert.ok(component.contentGrid.children[0].events.includes('contextmenu'));
    assert.ok(!component.contentGrid.children[0].events.some((event: string) => event.includes('click')));
    assert.ok(firstCardHtml.includes('class="card card--loaded selector layer--visible layer--render"'));
    assert.ok(!firstCardHtml.includes('card--category'));
    assert.ok(firstCardHtml.includes('<div class="card__view">'));
    // Native card starts with img_load.svg spinner; real src is set via imgEl.src = t.poster
    assert.ok(firstCardHtml.includes('src="./img/img_load.svg"'));
    assert.ok(firstCardHtml.includes('<div class="card__icons">'));
    // Memory storage must NOT display the storage badge
    assert.ok(!firstCardHtml.includes('<div class="card__type">'));
    assert.ok(!firstCardHtml.includes('MEMORY'));
    // An idle torrent must NOT display the active badge
    assert.ok(!firstCardHtml.includes('data-testid="active-torrent-badge"'));
    assert.ok(firstCardHtml.includes('<div class="card__title">Big Buck Bunny</div>'));
    assert.ok(firstCardHtml.includes('<div class="card__age">1 MB · 1 file</div>'));
    assert.ok(!firstCardHtml.includes('style="width: 13.5em'));
    assert.ok(!firstCardHtml.includes('padding-bottom: 150%'));

    const secondCardHtml = component.contentGrid.children[1].htmlString;
    assert.ok(secondCardHtml.includes('class="card card--loaded selector layer--visible layer--render"'));
    // File storage must display the storage badge
    assert.ok(secondCardHtml.includes(TORRPLAY_STORAGE_BADGE));
    assert.ok(secondCardHtml.includes('data-testid="file-storage-badge"'));
    assert.ok(secondCardHtml.includes('right: 0.5em'));
    // An actively streaming or downloading torrent must display the active badge opposite it
    assert.ok(secondCardHtml.includes(TORRPLAY_ACTIVE_BADGE));
    assert.ok(secondCardHtml.includes('data-testid="active-torrent-badge"'));
    assert.ok(secondCardHtml.includes('left: 0.5em'));
    assert.ok(secondCardHtml.includes('torrplay-active-dot__ping'));
    assert.ok(secondCardHtml.includes('<div class="card__title">Elephants Dream (2006)</div>'));
    assert.ok(secondCardHtml.includes('<div class="card__age">2 MB · 2 files</div>'));

    const emptyCardHtml = component.contentGrid.children[2].htmlString;
    // Memory storage must NOT display the storage badge
    assert.ok(!emptyCardHtml.includes('<div class="card__type">'));
    assert.ok(emptyCardHtml.includes('<div class="card__age">0 files</div>'));

    const unknownStorageCardHtml = component.contentGrid.children[3].htmlString;
    assert.ok(!unknownStorageCardHtml.includes('<div class="card__type">'));
    assert.ok(unknownStorageCardHtml.includes('<div class="card__age">3 MB · 3 files</div>'));
    assert.ok(!unknownStorageCardHtml.includes('CACHE'));

    assert.equal(isCollectionSetCalled, true);
    assert.equal(isCollectionFocusCalled, true);
  });

  it('strips HTML tags from torrent and file titles sourced from tracker metadata', async () => {
    const createMockElement = (tag: any) => {
      if (tag && typeof tag === 'object') {
        return tag;
      }
      const tagStr = typeof tag === 'string' ? tag : 'div';
      const children: any[] = [];
      const el: any = {
        0: { tagName: tagStr.startsWith('<') ? 'DIV' : tagStr.toUpperCase() },
        addClass: (_cls: string) => el,
        append: (child: any) => {
          children.push(child);
          return el;
        },
        attr: (_k: string, _v?: string) => el,
        children,
        empty: () => {
          children.length = 0;
          return el;
        },
        find: (_sel: string) => el,
        htmlString: tagStr,
        on: (_eventName: string, _callback: any) => el,
        remove: () => el,
        removeClass: (_cls?: string) => el,
        text: (_t?: string) => el,
      };
      return el;
    };

    class MockScroll {
      public append(_elem: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public nopadding() {}
      public render(_js?: boolean) { return createMockElement('div'); }
      public reset() {}
      public update() {}
    }

    (globalThis as any).$ = (tag: string) => createMockElement(tag);
    (globalThis as any).Lampa.Background = { change: () => {} };
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {},
      collectionSet: () => {},
    };
    (globalThis as any).Lampa.Scroll = MockScroll;
    // Mirrors Lampa.Utils.clearHtmlTags' real stripping behavior, rather than the
    // identity passthrough used elsewhere in this file, so this test actually
    // exercises sanitization instead of merely asserting it was called.
    (globalThis as any).Lampa.Utils = {
      bytesToSize: (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`,
      clearHtmlTags: (value: string) => value.replace(/<[^>]*>/g, ''),
    };

    const component = new TorrPlayTorrentsComponent() as any;
    component.scrollView.minus();
    component.scrollView.append(component.contentGrid);
    component.rootElement.append(component.scrollView.render());

    component.renderTorrents([
      {
        files: [{ length: 1048576, name: '<img src=x onerror=alert(1)>episode.mkv', path: 'episode.mkv' }],
        hash: 'hash1',
        name: 'Fallback Name',
        storage: 'memory',
        title: '<img src=x onerror=alert(1)>Malicious Torrent',
        total_size: 1048576,
      },
    ], {
      authType: 'none',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    });

    const cardHtml = component.contentGrid.children[0].htmlString;
    assert.ok(cardHtml.includes('<div class="card__title">Malicious Torrent</div>'));
    assert.ok(!cardHtml.includes('onerror'));

    (globalThis as any).Lampa.Modal = { close: () => {}, open: () => {} };
    const templateCalls: any[] = [];
    (globalThis as any).Lampa.Template = {
      get: (_name: string, data: any) => {
        templateCalls.push(data);
        return createMockElement(`<div class="torrent-file selector">${data.title}</div>`);
      },
    };
    (globalThis as any).Lampa.Timeline = {
      render: (_view: any) => createMockElement('<div class="time-line"></div>'),
      view: (hash: string) => ({ hash }),
    };

    const multiFileTorrent: any = {
      files: [
        { length: 1048576, name: '<img src=x onerror=alert(1)>episode-1.mkv', path: 'episode-1.mkv' },
        { length: 1048576, name: 'episode-2.mkv', path: 'episode-2.mkv' },
      ],
      hash: 'hash1',
      name: 'Fallback Name',
      title: 'Malicious Torrent',
    };

    await component.openTorrent(multiFileTorrent);

    assert.equal(templateCalls.length, 2, 'Each video file must produce a torrent-file card');
    assert.equal(templateCalls[0].title, 'episode-1', 'file title must be stripped of HTML tags before templating');
    assert.ok(!templateCalls[0].title.includes('<img'));
  });

  it('context menu offers switch-storage action and applies it via PATCH', async () => {
    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (message: string) => { notyMessages.push(message); };

    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public update() {}
    };
    (globalThis as any).$ = (tag: string) => ({
      append: () => (globalThis as any).$(tag),
      find: () => (globalThis as any).$(tag),
      remove: () => {},
    });

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      fileStoragePath: '/var/torrplay/storage',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const torrent: any = {
      created_at: '2026-01-15T10:30:00Z',
      files: [{ length: 1048576, name: 'movie.mkv', path: 'movie.mkv' }],
      hash: 'abc123456789',
      name: 'Big Buck Bunny',
      storage: 'memory',
      total_size: 1048576,
    };
    let isCardTypeRemoved = false;
    let appendedToCardView = '';
    const mockCardType = {
      length: 0,
      remove: () => { isCardTypeRemoved = true; },
    };
    const mockCardView = {
      append: (html: string) => { appendedToCardView = html; },
    };
    const cardElement = {
      find: (selector: string) => {
        if (selector === '.card__type') return mockCardType;
        if (selector === '.card__view') return mockCardView;
        return { length: 0 };
      },
      remove: () => {},
    };

    await component.openContextMenu(torrent, instance as any, cardElement as any);

    assert.equal(lastSelectOptions.title, 'Action', 'context menu title must match native title_action');

    const switchAction = lastSelectOptions.items.find((item: any) => item.action === 'switch-storage');
    assert.ok(switchAction, 'switch-storage action must be present for known storage when storage path is set');
    assert.equal(switchAction.title, 'Switch to Disk');
    assert.equal(switchAction.subtitle, 'Currently cached in RAM');

    const deleteAction = lastSelectOptions.items.find((item: any) => item.action === 'delete');
    assert.ok(deleteAction, 'delete action must be present in context menu');
    assert.equal(deleteAction.title, 'Delete from TorrPlay');
    assert.equal(deleteAction.subtitle, 'Remove torrent and cached data');

    let patchMethod = '';
    let patchBody = '';
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(input).endsWith('/api/v1/torrents/abc123456789'));
      patchMethod = init?.method || '';
      patchBody = String(init?.body || '');
      return new Response(JSON.stringify({ ...torrent, storage: 'file' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    };

    await lastSelectOptions.onSelect(switchAction);

    assert.equal(patchMethod, 'PATCH');
    assert.equal(patchBody, JSON.stringify({ storage: 'file' }));
    assert.equal(torrent.storage, 'file');
    assert.ok(appendedToCardView.includes(TORRPLAY_STORAGE_BADGE_ICON), 'switching to file storage must append badge to card');
    assert.ok(notyMessages.some(message => message.includes('Storage switched to Disk')));

    // A subsequent long-press or right-click must recompute the item for the new storage state
    await component.openContextMenu(torrent, instance as any, cardElement as any);
    const secondSwitchAction = lastSelectOptions.items.find((item: any) => item.action === 'switch-storage');
    assert.equal(secondSwitchAction.title, 'Switch to RAM');
    assert.equal(secondSwitchAction.subtitle, 'Currently stored on disk');

    // Switching back to memory removes the badge
    globalThis.fetch = async () => new Response(JSON.stringify({ ...torrent, storage: 'memory' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
    mockCardType.length = 1;
    await lastSelectOptions.onSelect(secondSwitchAction);
    assert.equal(torrent.storage, 'memory');
    assert.equal(isCardTypeRemoved, true, 'switching back to memory storage must remove badge from card');
  });

  it('context menu reports failure and keeps storage unchanged when PATCH fails', async () => {
    const notyMessages: string[] = [];
    (globalThis as any).Lampa.Noty.show = (message: string) => { notyMessages.push(message); };
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public update() {}
    };

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      fileStoragePath: '/var/torrplay/storage',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const torrent: any = {
      created_at: '2026-01-15T10:30:00Z',
      files: [],
      hash: 'def987654321',
      name: 'Elephants Dream',
      storage: 'file',
      total_size: 0,
    };
    const cardElement = { remove: () => {} };

    globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });

    await component.openContextMenu(torrent, instance as any, cardElement as any);
    const switchAction = lastSelectOptions.items.find((item: any) => item.action === 'switch-storage');
    await lastSelectOptions.onSelect(switchAction);

    assert.equal(torrent.storage, 'file');
    assert.ok(notyMessages.some(message => message.includes('Failed to switch storage')));
  });

  it('context menu omits switch-storage action for unknown storage', async () => {
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public update() {}
    };

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      fileStoragePath: '/var/torrplay/storage',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const torrent: any = {
      files: [],
      hash: 'unknown123456',
      name: 'Unknown Storage',
      storage: 'cache',
      total_size: 0,
    };
    const cardElement = { remove: () => {} };

    await component.openContextMenu(torrent, instance as any, cardElement as any);
    const switchAction = lastSelectOptions.items.find((item: any) => item.action === 'switch-storage');
    assert.ok(!switchAction, 'switch-storage action must be omitted for unknown storage');
  });

  it('context menu omits switch-storage action when file storage path is empty or not set', async () => {
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public update() {}
    };

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      fileStoragePath: '',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const torrent: any = {
      created_at: '2026-01-15T10:30:00Z',
      files: [],
      hash: 'file123456',
      name: 'Sample Torrent',
      storage: 'memory',
      total_size: 0,
    };
    const cardElement = { remove: () => {} };

    await component.openContextMenu(torrent, instance as any, cardElement as any);
    const switchAction = lastSelectOptions.items.find((item: any) => item.action === 'switch-storage');
    assert.ok(!switchAction, 'switch-storage action must be omitted when file storage path is empty');

    const deleteAction = lastSelectOptions.items.find((item: any) => item.action === 'delete');
    assert.ok(deleteAction, 'delete action must remain present');

    // Also verify when instance has no fileStoragePath property at all
    delete (instance as any).fileStoragePath;
    await component.openContextMenu(torrent, instance as any, cardElement as any);
    const switchActionAfter = lastSelectOptions.items.find((item: any) => item.action === 'switch-storage');
    assert.ok(!switchActionAfter, 'switch-storage action must be omitted when fileStoragePath is undefined');

    // When instance returns file_storage_path via GET /api/v1/settings, switch-storage becomes active
    globalThis.fetch = async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/v1/settings')) {
        return new Response(JSON.stringify({ file_storage_path: '/server/storage/dir' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      return new Response(null, { status: 200 });
    };
    delete (instance as any).fileStoragePath;
    await component.openContextMenu(torrent, instance as any, cardElement as any);
    const switchActionFetched = lastSelectOptions.items.find((item: any) => item.action === 'switch-storage');
    assert.ok(switchActionFetched, 'switch-storage action must appear when fileStoragePath is retrieved from instance');
  });

  it('suspends background refreshes while the context menu is open and restores focus on close', async () => {
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public nopadding() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public reset() {}
      public update() {}
    };

    const toggledControllers: string[] = [];
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {},
      collectionSet: () => {},
      enabled: () => ({ name: 'content' }),
      toggle: (name: string) => { toggledControllers.push(name); },
    };

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      fileStoragePath: '/var/torrplay/storage',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const torrent: any = {
      files: [],
      hash: 'poll123456789',
      name: 'Polled Torrent',
      storage: 'memory',
      total_size: 0,
    };
    const cardElement = { remove: () => {} };

    let renderTorrentsCallCount = 0;
    component.renderTorrents = () => { renderTorrentsCallCount++; };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/v1/settings')) {
        return new Response(JSON.stringify({ file_storage_path: '/var/torrplay/storage' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      return new Response(JSON.stringify({ torrents: [torrent] }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    };
    (InstanceManager as any).instances = [instance];

    await component.load(true);
    assert.equal(renderTorrentsCallCount, 1, 'a background poll must render while no context menu is open');

    await component.openContextMenu(torrent, instance as any, cardElement as any);

    // Rebuilding the grid here would detach the card the menu acts on and the element focus
    // is restored to when it closes.
    await component.load(true);
    assert.equal(renderTorrentsCallCount, 1, 'a background poll must not rebuild the grid while the context menu is open');

    lastSelectOptions.onBack();
    assert.deepEqual(toggledControllers, ['content'], 'closing the context menu must hand focus back to the grid');

    await component.load(true);
    assert.equal(renderTorrentsCallCount, 2, 'background refreshes must resume once the context menu is closed');

    // Navigating away with the menu still open must not suspend refreshes for good.
    await component.openContextMenu(torrent, instance as any, cardElement as any);
    component.pause();
    await component.load(true);
    assert.equal(renderTorrentsCallCount, 3, 'a menu left open across a lifecycle transition must not stall polling');

    component.destroy();
  });

  it('resumes polling after a single gesture opens the context menu twice', async () => {
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public nopadding() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public reset() {}
      public update() {}
    };
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {},
      collectionSet: () => {},
      enabled: () => ({ name: 'content' }),
      toggle: () => {},
    };

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      enableDownloader: true,
      fileStoragePath: '/var/torrplay/storage',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const torrent: any = {
      files: [],
      hash: 'reentrant12345',
      name: 'Reentrant Torrent',
      storage: 'memory',
      total_size: 0,
    };

    (component as any).startPolling();
    assert.notEqual((component as any).pollIntervalId, null, 'polling must be running before the menu opens');

    // A card binds the menu to both a long press and a context menu event, so one gesture
    // can reach here twice before the first menu is even shown.
    await component.openContextMenu(torrent, instance as any, { remove: () => {} } as any);
    await component.openContextMenu(torrent, instance as any, { remove: () => {} } as any);
    assert.equal((component as any).pollIntervalId, null, 'the open menu must suspend polling');

    lastSelectOptions.onBack();
    assert.notEqual((component as any).pollIntervalId, null, 'closing the menu must resume polling');

    component.destroy();
  });

  it('opens multi-file torrent via Lampa.Modal with torrent-file styled cards', async () => {
    let modalOptions: any = null;
    let isModalClosed = false;
    let timelineRenderCount = 0;
    let focusedRow: any = null;
    let isModalReady = false;
    (globalThis as any).Lampa.Controller = {
      ...((globalThis as any).Lampa.Controller || {}),
      collectionFocus: (target: any, container: any) => {
        assert.equal(isModalReady, true, 'focus must follow modal visibility setup');
        assert.equal(target, false);
        assert.equal(container, modalOptions.html);
        focusedRow = container.children[0];
      },
    };

    (globalThis as any).Lampa.Modal = {
      close: () => { isModalClosed = true; },
      open: (opts: any) => { modalOptions = opts; focusedRow = null; isModalReady = true; },
    };
    (globalThis as any).Lampa.Utils = {
      bytesToSize: (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`,
      clearHtmlTags: (value: string) => value,
      hash: (value: string) => value,
    };

    const capturedItems: string[] = [];
    const capturedTemplates: Array<{ data: any, name: string }> = [];
    (globalThis as any).$ = (html: string) => {
      capturedItems.push(html);
      const listeners: Record<string, any> = {};
      const el: any = {
        0: { style: {} },
        children: [],
        append: (child: any) => { el.children.push(child); return el; },
        find: (_selector: string) => el,
        on: (eventName: string, callback: any) => { listeners[eventName] = callback; return el; },
        __listeners: listeners,
        __html: html,
      };
      return el;
    };
    (globalThis as any).Lampa.Template = {
      get: (name: string, data: any) => {
        capturedTemplates.push({ data, name });
        return (globalThis as any).$(`
        <div class="${name === 'torrent_file_serial' ? 'torrent-serial' : 'torrent-file'} selector">
          <div class="torrent-file__title">${data.fname || data.title}<span class="exe">.${data.exe}</span></div>
          <div class="torrent-file__size">${data.size}</div>
        </div>
      `);
      },
    };
    (globalThis as any).Lampa.Timeline = {
      render: (_view: any) => {
        timelineRenderCount++;
        return (globalThis as any).$('<div class="time-line"></div>');
      },
      view: (hash: string) => ({ hash }),
    };

    (globalThis as any).Lampa.Scroll = class {
      append(_e: any) {}
      minus() {}
      render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      update() {}
    };

    const component = new TorrPlayTorrentsComponent();
    const multiFileTorrent: any = {
      files: [
        { length: 734003200, name: 'episode.S01E01.mkv', path: 'episode.S01E01.mkv' },
        { length: 734003200, name: 'episode.S01E02.m4v', path: 'episode.S01E02.m4v' },
        { length: 10240,     name: 'subtitle.srt',       path: 'subtitle.srt' },
      ],
      hash: 'multi123',
      name: 'My Show S01',
      poster: 'https://example.com/show-poster.jpg',
      title: 'My Show S01',
    };

    await component.openTorrent(multiFileTorrent);

    // Should have opened a Modal, not a Select
    assert.ok(modalOptions, 'Lampa.Modal.open must be called for multi-file torrent');
    assert.ok(focusedRow);
    assert.equal(focusedRow, modalOptions.html.children[0]);
    assert.equal(modalOptions.title, 'Files');
    assert.equal(modalOptions.mask, true);
    assert.equal(modalOptions.size, 'large');
    assert.ok(lastSelectOptions === null, 'Lampa.Select.show must NOT be called for multi-file torrent');

    // The html container should use torrent-files class
    const containerHtml = capturedItems.find(s => s.includes('torrent-files'));
    assert.ok(containerHtml, 'Container must have class torrent-files');

    const fileCards = capturedItems.filter(s => s.includes('torrent-serial selector'));
    // Only video files should be shown, including every format supported by the playback engine.
    assert.equal(fileCards.length, 2, 'Only video files should produce torrent-file cards');

    // Each file card must split title and extension correctly
    assert.ok(fileCards[0].includes('episode.S01E01'), 'First card must contain episode title');
    assert.ok(fileCards[0].includes('<span class="exe">.mkv</span>'), 'First card must have .mkv extension span');
    assert.ok(fileCards[0].includes('torrent-file__size'), 'First card must have size element');
    assert.ok(fileCards[1].includes('episode.S01E02'), 'Second card must contain episode title');
    assert.ok(fileCards[1].includes('<span class="exe">.m4v</span>'), 'Second card must support .m4v');
    assert.deepEqual(capturedTemplates.map(template => template.name), ['torrent_file_serial', 'torrent_file_serial']);
    assert.equal(capturedTemplates[0].data.img, 'https://example.com/show-poster.jpg');
    assert.equal(capturedTemplates[0].data.air_date, '--');
    assert.equal(timelineRenderCount, 2, 'Each file row must include the native timeline element');

    // Closing modal via onBack should call Lampa.Modal.close and toggle content controller
    let toggledController = '';
    (globalThis as any).Lampa.Controller = {
      ...((globalThis as any).Lampa.Controller || {}),
      toggle: (name: string) => { toggledController = name; },
    };
    modalOptions.onBack();
    assert.equal(isModalClosed, true, 'onBack must close the modal');
    assert.equal(toggledController, 'content', 'onBack must toggle back to content controller');
  });

  it('does not open a delayed file list after the component stops', async () => {
    let modalOpenCount = 0;
    let resolveSeasons: ((data: Record<string, LampaApiSeasonData>) => void) | undefined;

    (globalThis as any).$ = () => ({ append: () => {} });
    (globalThis as any).Lampa.Controller = { enabled: () => ({ name: 'content' }) };
    (globalThis as any).Lampa.Modal = { open: () => { modalOpenCount++; } };
    (globalThis as any).Lampa.Scroll = class {
      public append(_element: any) {}
      public destroy() {}
      public minus() {}
      public render() { return {}; }
    };

    const originalFetchSeasonEpisodes = TorrPlayEngine.fetchSeasonEpisodes;
    (TorrPlayEngine as any).fetchSeasonEpisodes = () => new Promise(resolve => {
      resolveSeasons = resolve;
    });

    try {
      const component = new TorrPlayTorrentsComponent();
      const opening = component.openTorrent({
        files: [
          { length: 1, name: 'Show.S01E01.mkv', path: 'Show.S01E01.mkv' },
          { length: 1, name: 'Show.S01E02.mkv', path: 'Show.S01E02.mkv' },
        ],
        hash: 'delayed-list',
        name: 'Show',
        storage: 'memory',
        total_size: 2,
      });

      component.stop();
      assert.ok(resolveSeasons);
      resolveSeasons({});
      await opening;

      assert.equal(modalOpenCount, 0);
    } finally {
      TorrPlayEngine.fetchSeasonEpisodes = originalFetchSeasonEpisodes;
    }
  });

  it('reports asynchronous file-list failures from torrent-card activation', async () => {
    const notyMessages: string[] = [];
    (globalThis as any).$ = () => ({ append: () => {} });
    (globalThis as any).Lampa.Noty = { show: (message: string) => { notyMessages.push(message); } };
    (globalThis as any).Lampa.Scroll = class {
      public append(_element: any) {}
      public destroy() {}
      public minus() {}
      public render() { return {}; }
    };

    const component = new TorrPlayTorrentsComponent() as any;
    component.openTorrent = async () => { throw new Error('metadata rendering failed'); };
    component.openTorrentSafely({ hash: 'broken' });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(notyMessages.length, 1);
    assert.ok(notyMessages[0].includes('metadata rendering failed'));
  });

  it('leaves the file list modal open (instead of closing it) when picking a file from the grid, so the player exit refocuses it', async () => {
    let modalOpenCount = 0;
    let modalCloseCount = 0;
    const templatedItems: any[] = [];

    (globalThis as any).Lampa.Modal = {
      close: () => { modalCloseCount += 1; },
      open: () => { modalOpenCount += 1; },
    };
    (globalThis as any).Lampa.Utils = {
      bytesToSize: (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`,
      clearHtmlTags: (value: string) => value,
      hash: (value: string) => value,
    };
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'torrplay_torrents' }),
      toggle: () => {},
    };
    (globalThis as any).$ = (_html?: string) => {
      const listeners: Record<string, any> = {};
      const el: any = {
        0: { style: {} },
        append: (_child: any) => el,
        find: (_selector: string) => el,
        on: (eventName: string, callback: any) => { listeners[eventName] = callback; return el; },
        __listeners: listeners,
      };
      return el;
    };
    (globalThis as any).Lampa.Template = {
      get: () => {
        const el = (globalThis as any).$('<div class="torrent-file selector"></div>');
        templatedItems.push(el);
        return el;
      },
    };
    (globalThis as any).Lampa.Scroll = class {
      append(_e: any) {}
      minus() {}
      render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      update() {}
    };

    let capturedReturnController: string | undefined;
    const originalStartTorrentPlayback = TorrPlayEngine.startTorrentPlayback;
    (TorrPlayEngine as any).startTorrentPlayback = async (
      _torrent: any,
      _fileIndex: number,
      _movie: any,
      _sourceInstance: any,
      returnController: string
    ) => {
      capturedReturnController = returnController;
    };

    try {
      const component = new TorrPlayTorrentsComponent();
      const multiFileTorrent: any = {
        files: [
          { length: 734003200, name: 'episode.S01E01.mkv', path: 'episode.S01E01.mkv' },
          { length: 734003200, name: 'episode.S01E02.mkv', path: 'episode.S01E02.mkv' },
        ],
        hash: 'multi-exit-test',
        name: 'My Show S01',
        title: 'My Show S01',
      };

      await component.openTorrent(multiFileTorrent);
      assert.equal(modalOpenCount, 1, 'file list modal should open initially');
      assert.equal(templatedItems.length, 2, 'both video files should be templated');

      templatedItems[0].__listeners['hover:enter']();

      assert.equal(modalCloseCount, 0, 'selecting a file must NOT close the file list modal (Lampa leaves it open behind the player)');
      assert.equal(
        capturedReturnController,
        'modal',
        'startTorrentPlayback must be told to refocus the modal (not the torrent card) on player exit'
      );
      assert.equal(modalOpenCount, 1, 'the modal must not be recreated');
    } finally {
      TorrPlayEngine.startTorrentPlayback = originalStartTorrentPlayback;
    }
  });

  it('plays the file the user picked from a database torrent, addressing it by its index in the complete file list', async () => {
    const templatedItems: any[] = [];
    const requestedFileIndexes: number[] = [];

    (globalThis as any).Lampa.Modal = { close: () => {}, open: () => {} };
    (globalThis as any).Lampa.Utils = {
      bytesToSize: (bytes: number) => `${bytes} B`,
      clearHtmlTags: (value: string) => value,
      hash: (value: string) => value,
    };
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'torrplay_torrents' }),
      toggle: () => {},
    };
    (globalThis as any).$ = (_html?: string) => {
      const listeners: Record<string, any> = {};
      const el: any = {
        0: { style: {} },
        append: (_child: any) => el,
        find: (_selector: string) => el,
        on: (eventName: string, callback: any) => { listeners[eventName] = callback; return el; },
        __listeners: listeners,
      };
      return el;
    };
    (globalThis as any).Lampa.Template = {
      get: () => {
        const el = (globalThis as any).$('<div class="torrent-file selector"></div>');
        templatedItems.push(el);
        return el;
      },
    };
    (globalThis as any).Lampa.Scroll = class {
      append(_e: any) {}
      minus() {}
      render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      update() {}
    };

    const originalStartTorrentPlayback = TorrPlayEngine.startTorrentPlayback;
    (TorrPlayEngine as any).startTorrentPlayback = async (_torrent: any, fileIndex: number) => {
      requestedFileIndexes.push(fileIndex);
    };

    try {
      const component = new TorrPlayTorrentsComponent();
      // Non-video entries and an out-of-order episode make the video-only sorted
      // list disagree with the torrent's own file order in both directions.
      await component.openTorrent({
        files: [
          { length: 1, name: 'poster.jpg', path: 'Show.S01/poster.jpg' },
          { length: 1, name: 'Show.S01E10.mkv', path: 'Show.S01/Show.S01E10.mkv' },
          { length: 1, name: 'Show.S01E01.mkv', path: 'Show.S01/Show.S01E01.mkv' },
          { length: 1, name: 'Show.S01E02.mkv', path: 'Show.S01/Show.S01E02.mkv' },
          { length: 1, name: 'readme.nfo', path: 'Show.S01/readme.nfo' },
        ],
        hash: 'multi-file-index',
        name: 'Show S01',
        storage: 'file',
        total_size: 5,
      } as any);

      assert.equal(templatedItems.length, 3, 'only the three video files should be listed');

      templatedItems[0].__listeners['hover:enter']();
      templatedItems[1].__listeners['hover:enter']();
      templatedItems[2].__listeners['hover:enter']();

      assert.deepEqual(
        requestedFileIndexes,
        [2, 3, 1],
        'rows are sorted E01, E02, E10 and must resolve to their own positions in the full file list'
      );
    } finally {
      TorrPlayEngine.startTorrentPlayback = originalStartTorrentPlayback;
    }
  });

  it('plays the only video of a database torrent by its real index when other files precede it', async () => {
    const requestedFileIndexes: number[] = [];

    (globalThis as any).$ = (_html?: string) => {
      const el: any = {
        append: (_child: any) => el,
        attr: (_name: string, _value?: string) => el,
        find: (_selector: string) => el,
        on: (_eventName: string, _callback: any) => el,
      };
      return el;
    };
    (globalThis as any).Lampa.Scroll = class {
      append(_e: any) {}
      minus() {}
      render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      update() {}
    };

    const originalStartTorrentPlayback = TorrPlayEngine.startTorrentPlayback;
    (TorrPlayEngine as any).startTorrentPlayback = async (_torrent: any, fileIndex: number) => {
      requestedFileIndexes.push(fileIndex);
    };

    try {
      const component = new TorrPlayTorrentsComponent();
      await component.openTorrent({
        files: [
          { length: 1, name: 'poster.jpg', path: 'Movie/poster.jpg' },
          { length: 1, name: 'sample.txt', path: 'Movie/sample.txt' },
          { length: 1, name: 'Movie.mkv', path: 'Movie/Movie.mkv' },
        ],
        hash: 'single-video-index',
        name: 'Movie',
        storage: 'file',
        total_size: 3,
      } as any);

      assert.deepEqual(requestedFileIndexes, [2]);
    } finally {
      TorrPlayEngine.startTorrentPlayback = originalStartTorrentPlayback;
    }
  });

  it('shows an error notice and stops loading when playback fails from the database torrents browser', async () => {
    const notyMessages: string[] = [];
    let loadingStopped = false;
    let toggledController = '';

    (globalThis as any).$ = (_html?: string) => {
      const el: any = {
        append: (_child: any) => el,
        attr: (_name: string, _value?: string) => el,
        find: (_selector: string) => el,
        on: (_eventName: string, _callback: any) => el,
      };
      return el;
    };
    (globalThis as any).Lampa.Noty.show = (message: string) => { notyMessages.push(message); };
    (globalThis as any).Lampa.Loading = { stop: () => { loadingStopped = true; } };
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'torrplay_torrents' }),
      toggle: (name: string) => { toggledController = name; },
    };
    (globalThis as any).Lampa.Scroll = class {
      append(_e: any) {}
      minus() {}
      render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      update() {}
    };

    const originalStartTorrentPlayback = TorrPlayEngine.startTorrentPlayback;
    let playbackSourceInstance: any = null;
    (TorrPlayEngine as any).startTorrentPlayback = async (
      _torrent: any,
      _fileIndex: number,
      _movie: any,
      sourceInstance: any
    ) => {
      playbackSourceInstance = sourceInstance;
      throw new Error('All configured TorrPlay instances are unreachable');
    };

    try {
      const component = new TorrPlayTorrentsComponent();
      const activeInstance = {
        authType: 'none',
        id: 'database-instance',
        name: 'Database Instance',
        url: 'http://database.example.com',
      };
      (component as any).activeInstance = activeInstance;
      const singleFileTorrent: any = {
        files: [{ length: 1000, name: 'movie.mkv', path: 'movie.mkv' }],
        hash: 'single123',
        name: 'Movie',
      };

      component.openTorrent(singleFileTorrent);

      // Playback failure is asynchronous — wait for the rejection to be handled.
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.equal(loadingStopped, true, 'Loading screen must be stopped on failure');
      assert.equal(playbackSourceInstance, activeInstance, 'Playback must stay on the instance that supplied the card');
      assert.equal(toggledController, 'torrplay_torrents', 'Launching controller must be restored on failure');
      assert.ok(
        notyMessages.some(message => message.includes('All configured TorrPlay instances are unreachable')),
        'An error notice must be shown when playback fails'
      );
    } finally {
      TorrPlayEngine.startTorrentPlayback = originalStartTorrentPlayback;
    }
  });

  it('filters out native TorrServer items from context menu when playback mode is Always TorrPlay', () => {
    let torrentListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'torrent') torrentListener = callback;
      },
    };

    (CatalogChoice as any).isRegistered = false;
    CatalogChoice.init();
    assert.ok(torrentListener, 'Torrent listener must be registered');

    // Test in 'ask' mode: tomy item is retained
    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'ask');
    const askMenu: any[] = [
      { mark: true, title: 'Mark' },
      { title: 'Add to TorrServer', tomy: true },
      { title: 'Remove Mark', unmark: true },
    ];
    torrentListener({
      element: { title: 'Test Torrent' },
      item: {},
      menu: askMenu,
      type: 'onlong',
    });
    assert.equal(askMenu[0].title, 'Play via TorrPlay', 'Play via TorrPlay must be first action');
    assert.equal(askMenu[1].title, 'Save to TorrPlay', 'Save to TorrPlay must be second action');
    assert.ok(askMenu.some(item => item.tomy), 'Native TorrServer item must be kept in ask mode');
    assert.ok(askMenu.some(item => item.mark), 'Mark action must be kept when unviewed');
    assert.equal(askMenu.some(item => item.unmark), false, 'Unmark action must be filtered when unviewed');

    // Test dynamic toggle when already marked viewed
    storageMap.set('torrents_view', ['viewed_hash']);
    const viewedMenu: any[] = [
      { mark: true, title: 'Mark' },
      { title: 'Remove Mark', unmark: true },
    ];
    torrentListener({
      element: { hash: 'viewed_hash', title: 'Viewed Torrent' },
      item: {},
      menu: viewedMenu,
      type: 'onlong',
    });
    assert.ok(viewedMenu.some(item => item.unmark), 'Unmark action must be kept when already viewed');
    assert.equal(viewedMenu.some(item => item.mark), false, 'Mark action must be filtered when already viewed');

    // Test in 'torrplay' mode: tomy item is stripped
    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
    const torrplayMenu: any[] = [
      { title: 'Add to TorrServer', tomy: true },
      { mark: true, title: 'Mark' },
      { title: 'Remove Mark', unmark: true },
    ];
    torrentListener({
      element: { title: 'Test Torrent' },
      item: {},
      menu: torrplayMenu,
      type: 'onlong',
    });
    assert.equal(torrplayMenu.some(item => item.tomy), false, 'Native TorrServer item must be removed in torrplay mode');
    assert.equal(torrplayMenu[0].title, 'Play via TorrPlay');
    assert.equal(torrplayMenu[0].subtitle, 'Stream via active TorrPlay instance');
    assert.equal(torrplayMenu[1].title, 'Save to TorrPlay');
    assert.equal(torrplayMenu[1].subtitle, 'Save torrent to instance for later playback');
    assert.ok(torrplayMenu.some(item => item.mark), 'Mark item should be preserved when unviewed');

    // Verify selecting 'Save to TorrPlay' passes resolved movie instead of DOM item
    let savedMovie: any = null;
    const origSaveToDb = TorrPlayEngine.saveToDatabase;
    TorrPlayEngine.saveToDatabase = async (_element: any, movie: any) => {
      savedMovie = movie;
    };

    const mockMovie = { id: 123, title: 'Context Movie' };
    (globalThis as any).Lampa.Activity = {
      active: () => ({
        component: 'torrents',
        movie: mockMovie,
      }),
    };

    const contextMenu: any[] = [];
    torrentListener({
      element: { title: 'Test Torrent' },
      item: {},
      menu: contextMenu,
      type: 'onlong',
    });

    const saveOption = contextMenu.find(item => item.title === 'Save to TorrPlay');
    assert.ok(saveOption);
    saveOption.onSelect();
    assert.deepEqual(savedMovie, mockMovie, 'Must pass active activity movie context instead of DOM element');
    TorrPlayEngine.saveToDatabase = origSaveToDb;
  });

  it('states that a searched torrent is already stored instead of offering to save it again', () => {
    let torrentListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'torrent') torrentListener = callback;
      },
    };

    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'ask');
    (CatalogChoice as any).isRegistered = false;
    CatalogChoice.init();

    const savedHash = 'a'.repeat(40);
    const unsavedHash = 'b'.repeat(40);
    SavedTorrents.reset();
    SavedTorrents.markSaved(savedHash);
    SavedTorrents.markUnsaved(unsavedHash);

    const savedMenu: any[] = [];
    torrentListener({
      element: { InfoHash: savedHash.toUpperCase(), title: 'Stored Torrent' },
      item: {},
      menu: savedMenu,
      type: 'onlong',
    });

    const savedNotice = savedMenu.find(item => item.title === 'Already in TorrPlay');
    assert.ok(savedNotice, 'A stored torrent must be reported as already stored');
    assert.equal(savedNotice.ghost, true, 'The notice must be drawn as inactive');
    assert.equal(savedNotice.noenter, true, 'The notice must not be selectable');
    assert.equal(
      savedMenu.some(item => item.title === 'Save to TorrPlay'),
      false,
      'A stored torrent must not be offered for saving again'
    );

    const unsavedMenu: any[] = [];
    torrentListener({
      element: { InfoHash: unsavedHash, title: 'New Torrent' },
      item: {},
      menu: unsavedMenu,
      type: 'onlong',
    });
    assert.ok(
      unsavedMenu.some(item => item.title === 'Save to TorrPlay'),
      'A torrent absent from the database must still be offered for saving'
    );

    const unknownMenu: any[] = [];
    torrentListener({
      element: { MagnetUri: `magnet:?xt=urn:btih:${'c'.repeat(40)}`, title: 'Unresolved Torrent' },
      item: {},
      menu: unknownMenu,
      type: 'onlong',
    });
    assert.ok(
      unknownMenu.some(item => item.title === 'Save to TorrPlay'),
      'A torrent whose state never resolved must keep the save action'
    );

    SavedTorrents.reset();
  });

  it('resolves stored state for rendered search results through a single filtered listing', async () => {
    let torrentListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'torrent') torrentListener = callback;
      },
    };

    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
    (CatalogChoice as any).isRegistered = false;
    CatalogChoice.init();

    const storedHash = 'd'.repeat(40);
    const clientOnlyHash = 'e'.repeat(40);
    const requestedUrls: string[] = [];
    globalThis.fetch = async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({
        torrents: [
          { created_at: '2026-01-15T10:30:00Z', files: [], hash: storedHash, name: 'Stored', storage: 'memory', total_size: 0 },
          { files: [], hash: clientOnlyHash, name: 'Client only', storage: 'memory', total_size: 0 },
        ],
      }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
    };

    SavedTorrents.reset();
    torrentListener({ element: { InfoHash: storedHash }, item: {}, type: 'render' });
    torrentListener({ element: { InfoHash: clientOnlyHash }, item: {}, type: 'render' });
    await new Promise(resolve => setTimeout(resolve, 400));

    const listingRequests = requestedUrls.filter(url => url.includes('/api/v1/torrents?'));
    assert.equal(listingRequests.length, 1, 'Rendered results must be resolved in one batched listing');
    assert.ok(
      listingRequests[0].includes(storedHash) && listingRequests[0].includes(clientOnlyHash),
      'The listing must be filtered server-side by the rendered hashes'
    );
    assert.equal(SavedTorrents.isSaved(storedHash), true, 'A database row must count as stored');
    assert.equal(
      SavedTorrents.isSaved(clientOnlyHash),
      false,
      'A torrent only loaded in the torrent client must not count as stored'
    );

    SavedTorrents.reset();
  });

  it('drops cached stored state when requests are rerouted to another instance', () => {
    const cachedHash = 'f'.repeat(40);

    (SavedTorrents as any).isRegistered = false;
    SavedTorrents.init();
    SavedTorrents.reset();
    SavedTorrents.markSaved(cachedHash);
    assert.equal(SavedTorrents.isSaved(cachedHash), true, 'Precondition: the hash is cached as stored');

    InstanceManager.addInstance({ authType: 'none', id: 'other-instance', name: 'Other', url: 'http://other.example' });
    InstanceManager.setSelectedId('other-instance');

    assert.equal(
      SavedTorrents.isSaved(cachedHash),
      undefined,
      'Another instance means another database, so the previous answer must not be reused'
    );

    InstanceManager.removeInstance('other-instance');
    SavedTorrents.reset();
  });

  it('retries a hash whose lookup failed instead of leaving it permanently unknown', async () => {
    const hash = '1'.repeat(40);
    const requestedUrls: string[] = [];
    let shouldFail = true;

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (shouldFail && url.includes('/api/v1/torrents')) return new Response('boom', { status: 500 });
      return new Response(JSON.stringify({
        torrents: [
          { created_at: '2026-01-15T10:30:00Z', files: [], hash, name: 'Stored', storage: 'memory', total_size: 0 },
        ],
      }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
    };

    SavedTorrents.reset();
    SavedTorrents.queueLookup(hash);
    await new Promise(resolve => setTimeout(resolve, 400));

    assert.equal(
      SavedTorrents.isSaved(hash),
      undefined,
      'A failed lookup must not be recorded as an answer'
    );
    assert.ok(
      requestedUrls.some(url => /[?&]limit=/.test(url)),
      'A lookup must cap the listing in case the server does not know the hash filter'
    );

    shouldFail = false;
    SavedTorrents.queueLookup(hash);
    await new Promise(resolve => setTimeout(resolve, 400));

    assert.equal(
      SavedTorrents.isSaved(hash),
      true,
      'The requeued hash must be resolved on the next lookup'
    );

    SavedTorrents.reset();
  });

  it('omits the storage switch for a torrent that is only loaded in the torrent client', async () => {
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public update() {}
    };

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      enableDownloader: true,
      fileStoragePath: '/var/torrplay/storage',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const clientOnlyTorrent: any = {
      files: [],
      hash: 'f'.repeat(40),
      name: 'Client Only Torrent',
      storage: 'memory',
      total_size: 0,
    };
    const cardElement = { remove: () => {} };

    await component.openContextMenu(clientOnlyTorrent, instance as any, cardElement as any);

    assert.equal(
      lastSelectOptions.items.some((item: any) => item.action === 'switch-storage'),
      false,
      'A torrent with no database row cannot be switched to file storage'
    );
    assert.ok(
      lastSelectOptions.items.some((item: any) => item.action === 'delete'),
      'The delete action must remain available'
    );
  });

  it('restores focus to the card list after an injected context menu action', () => {
    let torrentListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'torrent') torrentListener = callback;
      },
    };

    const toggledControllers: string[] = [];
    let enabledController = 'content';
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: enabledController }),
      toggle: (name: string) => { toggledControllers.push(name); },
    };

    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'ask');
    (CatalogChoice as any).isRegistered = false;
    CatalogChoice.init();

    const origSaveToDb = TorrPlayEngine.saveToDatabase;
    const origPlayDirect = TorrPlayEngine.playTorrentDirect;
    let playReturnController: string | undefined;
    TorrPlayEngine.saveToDatabase = async () => {};
    TorrPlayEngine.playTorrentDirect = (_element: any, _movie: any, returnController?: string) => {
      playReturnController = returnController;
    };

    try {
      const menu: any[] = [];
      torrentListener({
        element: { title: 'Test Torrent' },
        item: {},
        menu,
        type: 'onlong',
      });

      // Lampa's Select owns the controller by the time an item is chosen, so the injected
      // handlers must use the one captured when the menu was built.
      enabledController = 'select';

      menu.find(item => item.title === 'Save to TorrPlay').onSelect();
      assert.deepEqual(toggledControllers, ['content'], 'saving must hand focus back to the card list');

      menu.find(item => item.title === 'Play via TorrPlay').onSelect();
      assert.equal(playReturnController, 'content', 'playback must fall back to the card list, not the closed menu');
    } finally {
      TorrPlayEngine.saveToDatabase = origSaveToDb;
      TorrPlayEngine.playTorrentDirect = origPlayDirect;
    }
  });

  it('injects TorrPlay button into movie card details and opens torrents activity with torrplay flag', () => {
    let fullListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'full') fullListener = callback;
      },
    };

    let pushedActivity: any = null;
    (globalThis as any).Lampa.Activity = {
      push: (activity: any) => {
        pushedActivity = activity;
      },
    };

    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
    storageMap.set('parse_lang', 'df');

    (CatalogChoice as any).isRegistered = false;
    CatalogChoice.init();
    assert.ok(fullListener, 'Full listener must be registered');

    const torrentClasses = new Set<string>(['selector']);
    const injectedElements: any[] = [];
    const mock$: any = (arg: any) => {
      if (typeof arg === 'string') {
        const listeners: Record<string, any> = {};
        let subtitleVal = '';
        if (arg.includes('data-subtitle="Torrents via TorrPlay"')) {
          subtitleVal = 'Torrents via TorrPlay';
        }
        const el: any = {
          after: (child: any) => {
            injectedElements.push(child);
            return el;
          },
          append: (child: any) => {
            injectedElements.push(child);
            return el;
          },
          data: (key: string) => (key === 'subtitle' ? subtitleVal : undefined),
          find: (selector: string) => {
            if (selector === '.view--torrplay') {
              const matched = injectedElements.filter(e => e.__html && e.__html.includes('view--torrplay'));
              return {
                data: (k: string) => (matched[0] ? matched[0].data(k) : undefined),
                length: matched.length,
                text: () => (matched[0] ? matched[0].text() : ''),
                trigger: (evt: string) => {
                  if (matched[0] && matched[0].__listeners[evt]) matched[0].__listeners[evt]();
                },
              };
            }
            if (selector === '.view--torrent') {
              return {
                addClass: (c: string) => torrentClasses.add(c),
                after: (child: any) => {
                  injectedElements.push(child);
                },
                before: (child: any) => {
                  injectedElements.unshift(child);
                },
                hasClass: (c: string) => torrentClasses.has(c),
                length: 1,
                removeClass: (c: string) => torrentClasses.delete(c),
              };
            }
            if (selector === '.buttons--container') {
              return {
                append: (child: any) => {
                  injectedElements.push(child);
                },
                length: 1,
                prepend: (child: any) => {
                  injectedElements.unshift(child);
                },
              };
            }
            return { length: 0 };
          },
          length: 1,
          on: (eventName: string, handler: any) => {
            listeners[eventName] = handler;
            return el;
          },
          text: () => (arg.includes('TorrPlay') ? 'TorrPlay' : ''),
          trigger: (evt: string) => {
            if (listeners[evt]) listeners[evt]();
          },
          __html: arg,
          __listeners: listeners,
        };
        return el;
      }
      return arg;
    };
    (globalThis as any).$ = mock$;

    // Create mock DOM for movie card
    const mockBody = mock$('<div><div class="buttons--container"><div class="view--torrent"></div></div></div>');

    let groupButtonsEmitted = false;
    const mockEvent = {
      body: mockBody,
      data: {
        movie: {
          first_air_date: '2020-05-01',
          id: 789,
          original_title: 'Original Title',
          title: 'Localized Title',
        },
      },
      link: {
        items: [
          {
            emit: (eventName: string) => {
              if (eventName === 'groupButtons') groupButtonsEmitted = true;
            },
          },
        ],
      },
      type: 'complite',
    };

    // When in Always TorrPlay mode, native .view--torrent is hidden
    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
    fullListener(mockEvent);

    assert.equal(injectedElements[0].__html.includes('view--torrplay'), true, 'TorrPlay must be first in list');
    const torrplayBtn = mockBody.find('.view--torrplay');
    assert.equal(torrplayBtn.length, 1, 'TorrPlay button must be injected');
    assert.equal(torrplayBtn.data('subtitle'), 'Torrents via TorrPlay');
    assert.equal(torrplayBtn.text().trim(), 'TorrPlay');
    assert.equal(groupButtonsEmitted, true, 'groupButtons must be re-emitted');
    assert.equal(torrentClasses.has('hide'), true, 'Native button must have hide class in Always TorrPlay');
    assert.equal(torrentClasses.has('selector'), false, 'Native button must remove selector class in Always TorrPlay');

    // When in context/ask mode, native .view--torrent is not hidden
    torrentClasses.clear();
    torrentClasses.add('selector');
    injectedElements.length = 0;
    const askBody = mock$('<div><div class="buttons--container"><div class="view--torrent"></div></div></div>');
    storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'context');
    fullListener({
      ...mockEvent,
      body: askBody,
    });
    assert.equal(torrentClasses.has('hide'), false, 'Native button must not have hide class in context mode');
    assert.equal(torrentClasses.has('selector'), true, 'Native button must retain selector class in context mode');

    // Verify duplicate injection is prevented
    groupButtonsEmitted = false;
    fullListener(mockEvent);
    assert.equal(mockBody.find('.view--torrplay').length, 1, 'Duplicate button should not be injected');
    assert.equal(groupButtonsEmitted, false, 'groupButtons should not be emitted on duplicate');

    // Test button click (hover:enter)
    torrplayBtn.trigger('hover:enter');
    assert.ok(pushedActivity, 'Activity.push must be called on click');
    assert.equal(pushedActivity.component, 'torrents');
    assert.equal(pushedActivity.torrplay, true);
    assert.equal(pushedActivity.title, 'TorrPlay');
    assert.equal(pushedActivity.movie.torrplay, true);
    assert.equal(pushedActivity.movie.title, 'Localized Title');
    assert.equal(pushedActivity.search, 'Original Title');

    // Test disabled state
    injectedElements.length = 0;
    const disabledBody = mock$('<div><div class="buttons--container"><div class="view--torrent"></div></div></div>');
    storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, false);
    fullListener({
      ...mockEvent,
      body: disabledBody,
    });
    assert.equal(disabledBody.find('.view--torrplay').length, 0, 'Button must not be injected when plugin is disabled');
  });

  it('supports card details navigation and dynamic mark/unmark in database context menu', async () => {
    let pushedActivity: any = null;
    (globalThis as any).Lampa.Activity = {
      push: (act: any) => { pushedActivity = act; },
    };

    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return (globalThis as any).$('<div>'); }
      public update() {}
    };
    (globalThis as any).$ = (tag: string) => ({
      append: () => (globalThis as any).$(tag),
      find: () => (globalThis as any).$(tag),
      remove: () => {},
    });

    const component = new TorrPlayTorrentsComponent();
    const instance = {
      authType: 'none',
      id: 'test',
      name: 'Test Node',
      url: 'http://127.0.0.1:8090',
    };
    const torrent: any = {
      data: JSON.stringify({
        movie: { id: 456, name: 'Sample Show', title: 'Sample Show' },
      }),
      hash: 'torrent_db_123',
      name: 'Sample Show S01',
      storage: 'memory',
    };

    let appendedHtml = '';
    let isRemoved = false;
    const cardElement = {
      find: (sel: string) => {
        if (sel === '.card__icons-inner') {
          return {
            append: (h: string) => { appendedHtml = h; },
            find: () => ({ length: 0 }),
            length: 1,
          };
        }
        if (sel === '.card__icon--viewed') {
          return {
            remove: () => { isRemoved = true; },
          };
        }
        return { length: 0 };
      },
    };

    // 1. When unviewed: 'card' action and 'mark' action present
    storageMap.set('torrents_view', []);
    await component.openContextMenu(torrent, instance as any, cardElement as any);

    const cardAction = lastSelectOptions.items.find((i: any) => i.action === 'card');
    assert.ok(cardAction, 'Card details action must be present when movie metadata exists');
    await lastSelectOptions.onSelect(cardAction);
    assert.ok(pushedActivity);
    assert.equal(pushedActivity.component, 'full');
    assert.equal(pushedActivity.id, 456);

    const markAction = lastSelectOptions.items.find((i: any) => i.action === 'mark');
    assert.ok(markAction, 'Mark action must be present when unviewed');
    await lastSelectOptions.onSelect(markAction);
    const viewedStorage = (globalThis as any).Lampa.Storage.get('torrents_view', []);
    assert.ok(viewedStorage.includes('torrent_db_123'));
    assert.ok(appendedHtml.includes('card__icon--viewed'));

    // 2. When viewed: 'unmark' action present
    await component.openContextMenu(torrent, instance as any, cardElement as any);
    const unmarkAction = lastSelectOptions.items.find((i: any) => i.action === 'unmark');
    assert.ok(unmarkAction, 'Unmark action must be present when already viewed');
    await lastSelectOptions.onSelect(unmarkAction);
    const updatedStorage = (globalThis as any).Lampa.Storage.get('torrents_view', []);
    assert.equal(updatedStorage.includes('torrent_db_123'), false);
    assert.equal(isRemoved, true);
  });

  it('toggles torrplay--hide-torrserver body class and hides sidebar mytorrents when Always TorrPlay is active', () => {
    const classSet = new Set<string>();
    const mockBody = {
      classList: {
        contains: (cls: string) => classSet.has(cls),
        toggle: (cls: string, force: boolean) => {
          if (force) classSet.add(cls);
          else classSet.delete(cls);
        },
      },
    };
    let injectedCss = '';
    const myTorrentsClasses = new Set<string>(['selector']);
    const mockMyTorrents = {
      classList: {
        contains: (cls: string) => myTorrentsClasses.has(cls),
        toggle: (cls: string, force: boolean) => {
          if (force) myTorrentsClasses.add(cls);
          else myTorrentsClasses.delete(cls);
        },
      },
    };
    const viewTorrentClasses = new Set<string>(['selector']);
    const mockViewTorrent = {
      classList: {
        contains: (cls: string) => viewTorrentClasses.has(cls),
        toggle: (cls: string, force: boolean) => {
          if (force) viewTorrentClasses.add(cls);
          else viewTorrentClasses.delete(cls);
        },
      },
    };
    const parserFolderClasses = new Set<string>(['selector']);
    const mockParserFolder = {
      classList: {
        contains: (cls: string) => parserFolderClasses.has(cls),
        toggle: (cls: string, force: boolean) => {
          if (force) parserFolderClasses.add(cls);
          else parserFolderClasses.delete(cls);
        },
      },
    };
    const mockDocument = {
      body: mockBody,
      createElement: () => ({ id: '', textContent: '' }),
      getElementById: () => null,
      head: {
        appendChild: (elem: any) => {
          injectedCss = elem.textContent || '';
        },
      },
      querySelectorAll: (sel: string) => {
        const results: any[] = [];
        if (sel.includes('mytorrents')) results.push(mockMyTorrents);
        if (sel.includes('view--torrent')) results.push(mockViewTorrent);
        if (sel.includes('data-component="parser"')) results.push(mockParserFolder);
        return results;
      },
    };
    (globalThis as any).document = mockDocument;

    try {
      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
      SettingsUi.updateTorrServerVisibility();
      assert.equal(classSet.has('torrplay--hide-torrserver'), true);
      assert.ok(injectedCss.includes('.settings-folder[data-component="server"]'));
      assert.ok(injectedCss.includes('.settings-folder[data-component="parser"]'));
      assert.ok(injectedCss.includes('[data-action="mytorrents"]'));
      assert.ok(injectedCss.includes('.view--torrent'));
      assert.ok(injectedCss.includes('.full-start__button.view--torrent'));
      assert.ok(myTorrentsClasses.has('hide'));
      assert.equal(myTorrentsClasses.has('selector'), false);
      assert.ok(viewTorrentClasses.has('hide'));
      assert.equal(viewTorrentClasses.has('selector'), false);
      assert.ok(parserFolderClasses.has('hide'));
      assert.equal(parserFolderClasses.has('selector'), false);

      ProviderManager.addProvider({
        id: 'provider-1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
      });
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'ask');
      SettingsUi.updateTorrServerVisibility();
      assert.equal(classSet.has('torrplay--hide-torrserver'), false);
      assert.equal(classSet.has('torrplay--hide-native-parser'), true);
      assert.equal(myTorrentsClasses.has('hide'), false);
      assert.ok(myTorrentsClasses.has('selector'));
      assert.equal(viewTorrentClasses.has('hide'), false);
      assert.ok(viewTorrentClasses.has('selector'));
      assert.equal(parserFolderClasses.has('hide'), false);
      assert.ok(parserFolderClasses.has('selector'));

      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, false);
      SettingsUi.updateTorrServerVisibility();
      assert.equal(classSet.has('torrplay--hide-native-parser'), false);
      assert.equal(classSet.has('torrplay--hide-torrserver'), false);
      assert.equal(myTorrentsClasses.has('hide'), false);
      assert.ok(myTorrentsClasses.has('selector'));
      assert.equal(viewTorrentClasses.has('hide'), false);
      assert.ok(viewTorrentClasses.has('selector'));
      assert.equal(parserFolderClasses.has('hide'), false);
      assert.ok(parserFolderClasses.has('selector'));
    } finally {
      delete (globalThis as any).document;
    }
  });

  it('updates native TorrServer visibility on menu and activity events in SidebarManager', () => {
    let menuListener: any = null;
    let activityListener: any = null;
    (globalThis as any).Lampa.Listener = {
      follow: (event: string, callback: any) => {
        if (event === 'menu') menuListener = callback;
        if (event === 'activity') activityListener = callback;
      },
    };

    const classSet = new Set<string>();
    const mockBody = {
      classList: {
        contains: (cls: string) => classSet.has(cls),
        toggle: (cls: string, force: boolean) => {
          if (force) classSet.add(cls);
          else classSet.delete(cls);
        },
      },
    };
    const myTorrentsClasses = new Set<string>(['selector']);
    const mockMyTorrents = {
      classList: {
        contains: (cls: string) => myTorrentsClasses.has(cls),
        toggle: (cls: string, force: boolean) => {
          if (force) myTorrentsClasses.add(cls);
          else myTorrentsClasses.delete(cls);
        },
      },
    };
    const mockDocument = {
      body: mockBody,
      createElement: () => ({ id: '', textContent: '' }),
      getElementById: () => null,
      head: {
        appendChild: () => {},
      },
      querySelectorAll: (sel: string) => {
        if (sel.includes('mytorrents')) return [mockMyTorrents];
        return [];
      },
    };
    (globalThis as any).document = mockDocument;

    try {
      (SidebarManager as any).isRegistered = false;
      SidebarManager.init();
      assert.ok(menuListener, 'menu listener must be registered');
      assert.ok(activityListener, 'activity listener must be registered');

      storageMap.set(TORRPLAY_ENABLED_STORAGE_KEY, true);
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');

      // Trigger menu start event
      menuListener({ type: 'start' });
      assert.equal(classSet.has('torrplay--hide-torrserver'), true);
      assert.ok(myTorrentsClasses.has('hide'));
      assert.equal(myTorrentsClasses.has('selector'), false);

      // Trigger menu toggle event with ask mode
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'ask');
      menuListener({ type: 'toggle' });
      assert.equal(classSet.has('torrplay--hide-torrserver'), false);
      assert.equal(myTorrentsClasses.has('hide'), false);
      assert.ok(myTorrentsClasses.has('selector'));

      // Trigger activity event with torrplay mode
      storageMap.set(PLAYBACK_MODE_STORAGE_KEY, 'torrplay');
      activityListener();
      assert.equal(classSet.has('torrplay--hide-torrserver'), true);
      assert.ok(myTorrentsClasses.has('hide'));
      assert.equal(myTorrentsClasses.has('selector'), false);
    } finally {
      delete (globalThis as any).document;
    }
  });

  it('keeps background polling running regardless of controller or overlay state', async () => {
    class MockScroll {
      public append(_elem: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public nopadding() {}
      public render(_js?: boolean) {
        return { remove: () => {} };
      }
      public reset() {}
      public update() {}
    }
    (globalThis as any).Lampa.Scroll = MockScroll;
    (globalThis as any).$ = () => ({
      append: () => {},
      empty: () => {},
      remove: () => {},
    });

    // Lampa's controller focus reportedly never returns to 'content' after closing an
    // overlay such as Settings in some environments, so background polling must not depend
    // on that state — it previously stalled forever once anything else had been opened.
    (globalThis as any).Lampa.Controller = {
      enabled: () => ({ name: 'settings' }),
      toggle: () => {},
    };

    const component = new TorrPlayTorrentsComponent();
    let loadCallCount = 0;
    component.load = async () => {
      loadCallCount++;
    };

    await component.load(true);
    assert.equal(loadCallCount, 1, 'load must run even while the controller reports a non-content overlay');
    assert.equal((component as any).needsReload, false);

    component.destroy();
  });

  it('leaves the current view untouched when a background poll fails silently', async () => {
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return { remove: () => {} }; }
      public update() {}
    };
    (globalThis as any).$ = () => ({ append: () => {}, empty: () => {}, remove: () => {} });
    (InstanceManager as any).instances = [];

    const component = new TorrPlayTorrentsComponent();
    let renderEmptyStateCallCount = 0;
    component.renderEmptyState = () => { renderEmptyStateCallCount++; };

    await component.load(true);

    assert.equal(renderEmptyStateCallCount, 0, 'a silent background failure must not replace the current view with an error screen');
  });

  it('does not move scroll position or focus during a silent background refresh', () => {
    const createMockElement = (_tag: any) => {
      const el: any = {
        addClass: () => el,
        append: () => el,
        attr: () => el,
        empty: () => el,
        find: () => el,
        on: () => el,
        remove: () => el,
        removeClass: () => el,
        text: () => el,
      };
      return el;
    };
    (globalThis as any).$ = (tag: any) => (typeof tag === 'object' ? tag : createMockElement(tag));

    let updateCalls = 0;
    let collectionSetCalls = 0;
    let collectionFocusCalls = 0;
    class MockScroll {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return createMockElement('div'); }
      public reset() {}
      public update() { updateCalls++; }
    }
    (globalThis as any).Lampa.Scroll = MockScroll;
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => { collectionFocusCalls++; },
      collectionSet: () => { collectionSetCalls++; },
      enabled: () => ({ name: 'settings' }),
    };
    (globalThis as any).Lampa.Utils = { bytesToSize: () => '0 MB', clearHtmlTags: (value: string) => value };

    const component = new TorrPlayTorrentsComponent();
    const instance: any = { authType: 'none', id: 'a', name: 'A', url: 'http://a.local' };
    const torrents: any[] = [
      { files: [], hash: 'h1', name: 'Torrent One', storage: 'memory', total_size: 0 },
    ];

    component.renderTorrents(torrents, instance, true);
    assert.equal(updateCalls, 0, 'a silent refresh must not recompute scroll layout');
    assert.equal(collectionSetCalls, 0, 'a silent refresh must not touch controller focus');
    assert.equal(collectionFocusCalls, 0, 'a silent refresh must not touch controller focus');

    component.renderTorrents(torrents, instance, false);
    assert.equal(updateCalls, 1, 'a non-silent render must still recompute scroll layout');
    assert.equal(collectionSetCalls, 1);
    assert.equal(collectionFocusCalls, 1);
  });

  it('adds and removes the active badge as a background refresh sees the torrent start and stop', () => {
    const buildDom = (tag: any) => {
      const node: any = { children: [] as any[], contains: () => false };
      const el: any = {
        0: node,
        addClass: () => el,
        append: (child: any) => {
          node.children.push(child);
          return el;
        },
        attr: () => el,
        children: node.children,
        empty: () => { node.children.length = 0; return el; },
        find: () => el,
        htmlString: typeof tag === 'string' ? tag : '',
        on: () => el,
        remove: () => el,
        removeClass: () => el,
        text: () => el,
      };
      node.wrapper = el;
      return el;
    };

    (globalThis as any).$ = (tag: any) => (tag && typeof tag === 'object' ? (tag.wrapper || tag) : buildDom(tag));
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return buildDom('div'); }
      public reset() {}
      public update() {}
    };
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {},
      collectionSet: () => {},
      enabled: () => ({ name: 'content' }),
    };
    (globalThis as any).Lampa.Utils = { bytesToSize: () => '1 MB', clearHtmlTags: (value: string) => value };

    const component = new TorrPlayTorrentsComponent();
    const grid: any = (component as any).contentGrid;
    const instance: any = { authType: 'none', id: 'a', name: 'A', url: 'http://a.local' };
    const torrent = (active: boolean) => ([{ active, files: [], hash: 'h1', name: 'One', storage: 'memory', total_size: 0 }] as any[]);

    component.renderTorrents(torrent(false), instance, false);
    assert.ok(!grid.children[0].htmlString.includes('data-testid="active-torrent-badge"'));

    component.renderTorrents(torrent(true), instance, true);
    assert.ok(
      grid.children[0].htmlString.includes('data-testid="active-torrent-badge"'),
      'a background refresh must show the badge once the torrent starts'
    );

    component.renderTorrents(torrent(false), instance, true);
    assert.ok(
      !grid.children[0].htmlString.includes('data-testid="active-torrent-badge"'),
      'a background refresh must drop the badge once the torrent stops'
    );

    component.destroy();
  });

  it('re-registers the rebuilt cards with the navigator when a silent refresh replaces the focused card', () => {
    const buildDom = () => {
      const node: any = {
        children: [] as any[],
        classes: new Set<string>(),
        contains(candidate: any): boolean {
          return this.children.indexOf(candidate) >= 0;
        },
      };
      const handlers = new Map<string, any>();
      const el: any = {
        0: node,
        addClass: (name: string) => { node.classes.add(name); return el; },
        append: (child: any) => {
          if (child && child[0]) node.children.push(child[0]);
          return el;
        },
        attr: () => el,
        empty: () => { node.children.length = 0; return el; },
        find: () => el,
        handlers,
        on: (events: string, callback: any) => {
          events.split(' ').forEach(name => handlers.set(name, callback));
          return el;
        },
        remove: () => el,
        removeClass: () => el,
        text: () => el,
      };
      node.wrapper = el;
      return el;
    };

    (globalThis as any).$ = (tag: any) => (tag && typeof tag === 'object' ? (tag.wrapper || tag) : buildDom());

    let scrollUpdateCalls = 0;
    let collectionSetCalls = 0;
    let collectionFocusCalls = 0;
    class MockScroll {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return buildDom(); }
      public reset() {}
      public update() { scrollUpdateCalls++; }
    }
    (globalThis as any).Lampa.Scroll = MockScroll;
    (globalThis as any).Lampa.Background = { change: () => {} };
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => { collectionFocusCalls++; },
      collectionSet: () => { collectionSetCalls++; },
      enabled: () => ({ name: 'content' }),
    };
    (globalThis as any).Lampa.Utils = { bytesToSize: () => '0 MB', clearHtmlTags: (value: string) => value };

    let focusedElement: any = null;
    (globalThis as any).Lampa.Navigator = {
      focused: (element: any) => { focusedElement = element; },
      getFocusedElement: () => focusedElement,
      move: () => {},
    };

    const component = new TorrPlayTorrentsComponent();
    const grid: any = (component as any).contentGrid;
    const instance: any = { authType: 'none', id: 'a', name: 'A', url: 'http://a.local' };
    const torrent = (hash: string, name: string) => ({ files: [], hash, name, storage: 'memory', total_size: 0 });
    const torrents: any[] = [torrent('h1', 'One'), torrent('h2', 'Two')];

    component.renderTorrents(torrents, instance, false);
    const initialCards = grid[0].children.slice();
    assert.equal(initialCards.length, 2);

    // The user lands on the second card, which is what the navigator now steers by.
    initialCards[1].wrapper.handlers.get('hover:focus')({ currentTarget: initialCards[1] });
    focusedElement = initialCards[1];

    const scrollUpdatesBeforePoll = scrollUpdateCalls;
    collectionSetCalls = 0;
    collectionFocusCalls = 0;

    // An unchanged listing must leave the live card elements in place.
    component.renderTorrents(torrents, instance, true);
    assert.deepEqual(grid[0].children, initialCards, 'an unchanged silent refresh must not rebuild the grid');
    assert.equal(collectionSetCalls, 0);

    // A changed listing rebuilds every card, detaching the one the navigator holds.
    component.renderTorrents([...torrents, torrent('h3', 'Three')], instance, true);
    const rebuiltCards = grid[0].children.slice();
    assert.equal(rebuiltCards.length, 3);
    assert.equal(collectionSetCalls, 1, 'the rebuilt cards must be handed to the navigator collection');
    assert.equal(collectionFocusCalls, 0, 'restoring the cursor must not re-trigger hover:focus');
    assert.equal(scrollUpdateCalls, scrollUpdatesBeforePoll, 'a silent refresh must not move the scroll position');
    assert.equal(focusedElement, rebuiltCards[1], 'the cursor must move to the replacement of the same torrent card');
    assert.ok(grid[0].contains(focusedElement), 'the navigator must never be left pointing at a detached card');
    assert.ok(rebuiltCards[1].classes.has('focus'), 'the replacement card must carry the focus marker');

    component.destroy();
  });

  it('leaves the navigator alone when a silent refresh runs while another screen holds focus', () => {
    const buildDom = () => {
      const node: any = {
        children: [] as any[],
        classes: new Set<string>(),
        contains(candidate: any): boolean {
          return this.children.indexOf(candidate) >= 0;
        },
      };
      const el: any = {
        0: node,
        addClass: () => el,
        append: (child: any) => {
          if (child && child[0]) node.children.push(child[0]);
          return el;
        },
        attr: () => el,
        empty: () => { node.children.length = 0; return el; },
        find: () => el,
        on: () => el,
        remove: () => el,
        removeClass: () => el,
        text: () => el,
      };
      node.wrapper = el;
      return el;
    };

    (globalThis as any).$ = (tag: any) => (tag && typeof tag === 'object' ? (tag.wrapper || tag) : buildDom());

    let collectionSetCalls = 0;
    let collectionFocusCalls = 0;
    class MockScroll {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return buildDom(); }
      public reset() {}
      public update() {}
    }
    (globalThis as any).Lampa.Scroll = MockScroll;
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => { collectionFocusCalls++; },
      collectionSet: () => { collectionSetCalls++; },
      enabled: () => ({ name: 'content' }),
    };
    (globalThis as any).Lampa.Utils = { bytesToSize: () => '0 MB', clearHtmlTags: (value: string) => value };

    const foreignElement: any = { classes: new Set<string>() };
    let focusedElement: any = foreignElement;
    (globalThis as any).Lampa.Navigator = {
      focused: (element: any) => { focusedElement = element; },
      getFocusedElement: () => focusedElement,
      move: () => {},
    };

    const component = new TorrPlayTorrentsComponent();
    const instance: any = { authType: 'none', id: 'a', name: 'A', url: 'http://a.local' };
    const torrents: any[] = [{ files: [], hash: 'h1', name: 'One', storage: 'memory', total_size: 0 }];

    component.renderTorrents(torrents, instance, true);
    component.renderTorrents([...torrents, { files: [], hash: 'h2', name: 'Two', storage: 'memory', total_size: 0 }], instance, true);

    assert.equal(collectionSetCalls, 0, 'a silent refresh must not touch the collection of the screen that holds focus');
    assert.equal(collectionFocusCalls, 0);
    assert.equal(focusedElement, foreignElement, 'a silent refresh must not pull the cursor away from another screen');

    component.destroy();
  });

  it('rebuilds the cards when a silent refresh switches instance behind an identical listing', () => {
    const buildDom = () => {
      const node: any = { children: [] as any[] };
      const handlers = new Map<string, any>();
      const el: any = {
        0: node,
        addClass: () => el,
        append: (child: any) => {
          if (child && child[0]) node.children.push(child[0]);
          return el;
        },
        attr: () => el,
        empty: () => { node.children.length = 0; return el; },
        find: () => el,
        handlers,
        on: (events: string, callback: any) => {
          events.split(' ').forEach(name => handlers.set(name, callback));
          return el;
        },
        remove: () => el,
        removeClass: () => el,
        text: () => el,
      };
      node.wrapper = el;
      return el;
    };

    (globalThis as any).$ = (tag: any) => (tag && typeof tag === 'object' ? (tag.wrapper || tag) : buildDom());
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return buildDom(); }
      public reset() {}
      public update() {}
    };
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {},
      collectionSet: () => {},
      enabled: () => ({ name: 'content' }),
    };
    (globalThis as any).Lampa.Utils = { bytesToSize: () => '0 MB', clearHtmlTags: (value: string) => value };

    const component = new TorrPlayTorrentsComponent();
    const grid: any = (component as any).contentGrid;
    const torrents: any[] = [{ files: [], hash: 'h1', name: 'One', storage: 'memory', total_size: 0 }];
    const first: any = { authType: 'none', id: 'a', name: 'A', url: 'http://a.local' };
    const second: any = { authType: 'none', id: 'b', name: 'B', url: 'http://b.local' };

    component.renderTorrents(torrents, first, false);
    const initialCard = grid[0].children[0];

    component.renderTorrents(torrents, first, true);
    assert.equal(grid[0].children[0], initialCard, 'an unchanged silent refresh must not rebuild the grid');

    // A failover hands the same listing over from a different instance: the cards close over the
    // instance, so they have to be rebuilt even though nothing on screen changes.
    component.renderTorrents(torrents, second, true);
    assert.notEqual(grid[0].children[0], initialCard, 'a silent refresh after a failover must rebuild the cards');

    let contextInstance: any = null;
    (component as any).openContextMenu = (_t: any, usedInstance: any) => { contextInstance = usedInstance; };
    grid[0].children[0].wrapper.handlers.get('hover:long')({});
    assert.equal(contextInstance, second, 'the rebuilt cards must act on the instance that is now serving them');

    component.destroy();
  });

  it('renders the empty state once across repeated silent refreshes', () => {
    const buildDom = () => {
      const node: any = { children: [] as any[] };
      const el: any = {
        0: node,
        addClass: () => el,
        append: (child: any) => {
          if (child && child[0]) node.children.push(child[0]);
          return el;
        },
        attr: () => el,
        empty: () => { node.children.length = 0; return el; },
        find: () => el,
        on: () => el,
        remove: () => el,
        removeClass: () => el,
        text: () => el,
      };
      node.wrapper = el;
      return el;
    };

    (globalThis as any).$ = (tag: any) => (tag && typeof tag === 'object' ? (tag.wrapper || tag) : buildDom());

    const appended: any[] = [];
    class MockScroll {
      public append(element: any) { appended.push(element); }
      public clear() { appended.length = 0; }
      public destroy() {}
      public minus() {}
      public nopadding() {}
      public render(_js?: boolean) { return buildDom(); }
      public reset() {}
      public update() {}
    }
    (globalThis as any).Lampa.Scroll = MockScroll;
    (globalThis as any).Lampa.Empty = class {
      public destroy() {}
      public render() { return buildDom(); }
      public start() {}
    };
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {},
      collectionSet: () => {},
      enabled: () => ({ name: 'content' }),
    };
    (globalThis as any).Lampa.Utils = { bytesToSize: () => '0 MB', clearHtmlTags: (value: string) => value };

    const component = new TorrPlayTorrentsComponent();
    component.renderEmptyState('No torrents found', 'TorrPlay', false);
    const appendedAfterFirstRender = appended.length;

    component.renderEmptyState('No torrents found', 'TorrPlay', true);
    component.renderEmptyState('No torrents found', 'TorrPlay', true);
    assert.equal(appended.length, appendedAfterFirstRender, 'repeated silent refreshes must not stack empty states');

    // A different message is a real change and must replace what is on screen.
    component.renderEmptyState('Instances unreachable', 'TorrPlay', true);
    assert.equal(appended.length, appendedAfterFirstRender + 1);

    component.destroy();
  });

  it('falls back to the focus marker class when the navigator cannot report its focused element', () => {
    const buildDom = () => {
      const node: any = {
        children: [] as any[],
        classes: new Set<string>(),
        querySelector(selector: string): any {
          return selector === '.card.focus'
            ? this.children.find((child: any) => child.classes && child.classes.has('focus')) || null
            : null;
        },
      };
      const handlers = new Map<string, any>();
      const el: any = {
        0: node,
        addClass: (name: string) => { node.classes.add(name); return el; },
        append: (child: any) => {
          if (child && child[0]) node.children.push(child[0]);
          return el;
        },
        attr: () => el,
        empty: () => { node.children.length = 0; return el; },
        find: () => el,
        handlers,
        on: (events: string, callback: any) => {
          events.split(' ').forEach(name => handlers.set(name, callback));
          return el;
        },
        remove: () => el,
        removeClass: () => el,
        text: () => el,
      };
      node.wrapper = el;
      return el;
    };

    (globalThis as any).$ = (tag: any) => (tag && typeof tag === 'object' ? (tag.wrapper || tag) : buildDom());

    let collectionSetCalls = 0;
    (globalThis as any).Lampa.Scroll = class {
      public append(_e: any) {}
      public clear() {}
      public destroy() {}
      public minus() {}
      public render(_js?: boolean) { return buildDom(); }
      public reset() {}
      public update() {}
    };
    (globalThis as any).Lampa.Background = { change: () => {} };
    (globalThis as any).Lampa.Controller = {
      collectionFocus: () => {},
      collectionSet: () => { collectionSetCalls++; },
      enabled: () => ({ name: 'content' }),
    };
    (globalThis as any).Lampa.Utils = { bytesToSize: () => '0 MB', clearHtmlTags: (value: string) => value };

    // A navigator without getFocusedElement: the grid has to recognise its own cursor anyway.
    let focusedElement: any = null;
    (globalThis as any).Lampa.Navigator = {
      focused: (element: any) => { focusedElement = element; },
      move: () => {},
    };

    const component = new TorrPlayTorrentsComponent();
    const grid: any = (component as any).contentGrid;
    const instance: any = { authType: 'none', id: 'a', name: 'A', url: 'http://a.local' };
    const torrents: any[] = [{ files: [], hash: 'h1', name: 'One', storage: 'memory', total_size: 0 }];

    component.renderTorrents(torrents, instance, false);
    const initialCard = grid[0].children[0];
    initialCard.wrapper.handlers.get('hover:focus')({ currentTarget: initialCard });
    initialCard.classes.add('focus');

    collectionSetCalls = 0;
    component.renderTorrents([...torrents, { files: [], hash: 'h2', name: 'Two', storage: 'memory', total_size: 0 }], instance, true);

    assert.equal(collectionSetCalls, 1, 'the rebuilt cards must still be handed to the navigator collection');
    assert.equal(focusedElement, grid[0].children[0], 'the cursor must move to the replacement of the same torrent card');

    component.destroy();
  });

  it('does not install a global ad-blocking stylesheet', () => {
    const originalDocument = (globalThis as any).document;
    const styleElements: any[] = [];

    (globalThis as any).document = {
      createElement: () => ({ id: '', textContent: '' }),
      getElementById: (id: string) => styleElements.find(element => element.id === id) || null,
      head: {
        appendChild: (element: any) => styleElements.push(element),
      },
    };

    try {
      SettingsUi.init();
      assert.equal(
        styleElements.some(element => (
          element.textContent.includes('.ad-preroll')
          || element.textContent.includes('.ad-video-block')
          || element.textContent.includes('.ad-banner')
        )),
        false
      );
    } finally {
      if (originalDocument === undefined) {
        delete (globalThis as any).document;
      } else {
        (globalThis as any).document = originalDocument;
      }
    }
  });

});
