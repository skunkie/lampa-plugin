// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ParserHook } from '../src/providers/parser-hook';
import { PROVIDER_SEARCH_ENABLED_STORAGE_KEY, ProviderManager } from '../src/providers/provider-manager';
import { TorrentProvider } from '../src/types/provider';
import { ProviderSettingsUi } from '../src/ui/provider-settings';
import { createTestLanguage, getTestTranslation } from './support/translations';

describe('ProviderSettingsUi', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();

  let lastSelectOptions: any = null;
  let lastInputOptions: any = null;

  beforeEach(() => {
    storageMap.clear();
    lastSelectOptions = null;
    lastInputOptions = null;

    (globalThis as any).Lampa = {
      Controller: {
        toggle: () => {},
      },
      Input: {
        edit: (options: any, callback: any) => {
          lastInputOptions = options;
          callback('http://192.168.1.200:9117');
        },
      },
      Lang: createTestLanguage(),
      Noty: {
        show: () => {},
      },
      Select: {
        close: () => {},
        show: (options: any) => {
          lastSelectOptions = options;
        },
      },
      Storage: {
        get: (key: string, defaultValue: any) => (storageMap.has(key) ? storageMap.get(key) : defaultValue),
        set: (key: string, value: any) => storageMap.set(key, value),
      },
    };

    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();
    (ParserHook as any).isGlobalSearchIntegrated = true;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const jackettProvider: TorrentProvider = {
    apiKey: 'k', id: 'p1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local:9117',
  };

  function findGlobalSearchToggle(): any {
    return lastSelectOptions.items.find((item: any) => item.action === 'toggle_global_search');
  }

  it('offers the global search toggle only while enabled providers replace native search', () => {
    ProviderSettingsUi.openPoolManager();
    assert.equal(findGlobalSearchToggle(), undefined);

    ProviderManager.addProvider({ ...jackettProvider, isEnabled: false });
    ProviderSettingsUi.openPoolManager();
    assert.equal(findGlobalSearchToggle(), undefined);

    ProviderManager.updateProvider({ ...jackettProvider });
    ProviderSettingsUi.openPoolManager();
    assert.ok(findGlobalSearchToggle());

    storageMap.set('torrplay_enabled', false);
    ProviderSettingsUi.openPoolManager();
    assert.equal(findGlobalSearchToggle(), undefined);
  });

  it('hides the global search toggle when the global search integration was never installed', () => {
    (ParserHook as any).isGlobalSearchIntegrated = false;
    ProviderManager.addProvider({ ...jackettProvider });

    ProviderSettingsUi.openPoolManager();
    assert.equal(findGlobalSearchToggle(), undefined);
  });

  it('switches provider results in global search on and off from the pool manager', () => {
    ProviderManager.addProvider({ ...jackettProvider });
    storageMap.set(PROVIDER_SEARCH_ENABLED_STORAGE_KEY, 'false');

    ProviderSettingsUi.openPoolManager();
    assert.ok(findGlobalSearchToggle().subtitle.endsWith(getTestTranslation('torrplay_status_disabled')));
    lastSelectOptions.onSelect(findGlobalSearchToggle());
    assert.equal(storageMap.get(PROVIDER_SEARCH_ENABLED_STORAGE_KEY), 'true');

    // The pool manager reopens with the new state.
    assert.ok(findGlobalSearchToggle().subtitle.endsWith(getTestTranslation('torrplay_status_enabled')));
    lastSelectOptions.onSelect(findGlobalSearchToggle());
    assert.equal(storageMap.get(PROVIDER_SEARCH_ENABLED_STORAGE_KEY), 'false');
  });

  it('opens the TV-friendly provider pool manager via Lampa.Select', () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, name: 'Home Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    });

    ProviderSettingsUi.openPoolManager();
    assert.ok(lastSelectOptions);
    assert.equal(lastSelectOptions.title, getTestTranslation('torrplay_provider_pool_title'));

    const addAction = lastSelectOptions.items.find((i: any) => i.action === 'add');
    assert.ok(addAction);

    const providerItem = lastSelectOptions.items.find((i: any) => i.action === 'provider');
    assert.ok(providerItem);
    assert.ok(providerItem.title.includes('Home Jackett'));
    assert.ok(providerItem.title.includes('Jackett'));

    const backAction = lastSelectOptions.items.find((i: any) => i.action === 'back');
    assert.ok(backAction);
  });

  it('localizes the latency unit in the provider pool list', () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'p1', isEnabled: true, latencyMs: 35, name: 'Home Jackett', status: 'online', type: 'jackett', url: 'http://jackett.local:9117',
    });
    (globalThis as any).Lampa.Lang = createTestLanguage('ru');

    ProviderSettingsUi.openPoolManager();
    const providerItem = lastSelectOptions.items.find((item: any) => item.action === 'provider');
    assert.ok(providerItem.subtitle.includes(getTestTranslation('torrplay_latency_ms', { latency: 35 }, 'ru')));
  });

  it('opens provider actions and lists expected menu items', () => {
    const provider: TorrentProvider = {
      apiKey: 'secret', id: 'p1', isEnabled: true, name: 'Home Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    };
    ProviderManager.addProvider(provider);

    ProviderSettingsUi.openProviderActions(provider);
    const actionNames = lastSelectOptions.items.map((i: any) => i.action);
    assert.ok(actionNames.includes('toggle_enabled'));
    assert.ok(actionNames.includes('test'));
    assert.ok(actionNames.includes('edit_name'));
    assert.ok(actionNames.includes('edit_url'));
    assert.ok(actionNames.includes('edit_api_key'));
    assert.ok(actionNames.includes('switch_type'));
    assert.ok(actionNames.includes('delete'));
    assert.ok(actionNames.includes('back'));

    // API key is masked, never shown in plaintext
    const editApiKeyItem = lastSelectOptions.items.find((i: any) => i.action === 'edit_api_key');
    assert.equal(editApiKeyItem.subtitle, '••••••••');
  });

  it('toggles a provider enabled/disabled', () => {
    const provider: TorrentProvider = {
      id: 'p1', isEnabled: true, name: 'Home Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    };
    ProviderManager.addProvider(provider);

    ProviderSettingsUi.openProviderActions(provider);
    const toggleAction = lastSelectOptions.items.find((i: any) => i.action === 'toggle_enabled');
    lastSelectOptions.onSelect(toggleAction);

    assert.equal(ProviderManager.getProviders().find(p => p.id === 'p1')?.isEnabled, false);
  });

  it('switches provider type between jackett and prowlarr', () => {
    const provider: TorrentProvider = {
      id: 'p1', isEnabled: true, name: 'Node', type: 'jackett', url: 'http://node.example.com',
    };
    ProviderManager.addProvider(provider);

    ProviderSettingsUi.openProviderActions(provider);
    const switchAction = lastSelectOptions.items.find((i: any) => i.action === 'switch_type');
    lastSelectOptions.onSelect(switchAction);

    assert.equal(ProviderManager.getProviders().find(p => p.id === 'p1')?.type, 'prowlarr');
  });

  it('rejects invalid provider URLs when adding', () => {
    (globalThis as any).Lampa.Input.edit = (options: any, callback: any) => {
      lastInputOptions = options;
      callback('not a valid url');
    };

    ProviderSettingsUi.promptAddProvider();
    assert.equal(ProviderManager.getProviders().length, 0);
  });

  it('rejects duplicate provider URLs when adding', () => {
    ProviderManager.addProvider({
      id: 'existing', isEnabled: true, name: 'Existing', type: 'jackett', url: 'http://192.168.1.200:9117',
    });

    ProviderSettingsUi.promptAddProvider();
    assert.equal(ProviderManager.getProviders().length, 1);
  });

  it('adds a new provider defaulting to jackett type and hostname-based name', () => {
    ProviderSettingsUi.promptAddProvider();
    assert.ok(lastInputOptions.title.includes(getTestTranslation('torrplay_instance_url_placeholder')));
    const added = ProviderManager.getProviders().find(p => p.url === 'http://192.168.1.200:9117');
    assert.ok(added);
    assert.equal(added?.type, 'jackett');
    assert.equal(added?.name, '192.168.1.200');
  });

  it('requires confirmation before deleting a provider', () => {
    const provider: TorrentProvider = {
      id: 'p1', isEnabled: true, name: 'Home Jackett', type: 'jackett', url: 'http://jackett.local:9117',
    };
    ProviderManager.addProvider(provider);

    ProviderSettingsUi.openProviderActions(provider);
    const deleteAction = lastSelectOptions.items.find((i: any) => i.action === 'delete');
    lastSelectOptions.onSelect(deleteAction);

    // Confirmation dialog shown, provider not yet removed
    assert.equal(ProviderManager.getProviders().length, 1);
    assert.ok(lastSelectOptions.title.includes(getTestTranslation('torrplay_confirm_delete_title')));

    const confirmAction = lastSelectOptions.items.find((i: any) => i.action === 'confirm_delete');
    lastSelectOptions.onSelect(confirmAction);
    assert.equal(ProviderManager.getProviders().length, 0);
  });
});
