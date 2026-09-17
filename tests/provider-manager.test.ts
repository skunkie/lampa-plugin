// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ProviderManager } from '../src/providers/provider-manager';
import { TorrentProvider } from '../src/types/provider';

describe('ProviderManager', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();

  beforeEach(() => {
    storageMap.clear();
    (globalThis as any).Lampa = {
      Noty: {
        show: () => {},
      },
      Storage: {
        get: (key: string, defaultValue: any) => (
          storageMap.has(key) ? storageMap.get(key) : defaultValue
        ),
        set: (key: string, value: any) => storageMap.set(key, value),
      },
    };
    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('manages provider lifecycle (add, update, remove)', () => {
    const provider: TorrentProvider = {
      apiKey: 'abc123',
      id: 'prov-1',
      isEnabled: true,
      name: 'Home Jackett',
      type: 'jackett',
      url: 'http://192.168.1.50:9117',
    };

    ProviderManager.addProvider(provider);
    let providers = ProviderManager.getProviders();
    assert.ok(providers.some(candidate => candidate.id === 'prov-1'));

    provider.name = 'Updated Jackett';
    ProviderManager.updateProvider(provider);
    providers = ProviderManager.getProviders();
    assert.equal(providers.find(candidate => candidate.id === 'prov-1')?.name, 'Updated Jackett');

    ProviderManager.removeProvider('prov-1');
    providers = ProviderManager.getProviders();
    assert.ok(!providers.some(candidate => candidate.id === 'prov-1'));
  });

  it('filters enabled providers only', () => {
    ProviderManager.addProvider({
      id: 'enabled-1', isEnabled: true, name: 'Enabled', type: 'jackett', url: 'http://a.example.com',
    });
    ProviderManager.addProvider({
      id: 'disabled-1', isEnabled: false, name: 'Disabled', type: 'prowlarr', url: 'http://b.example.com',
    });

    const enabled = ProviderManager.getEnabledProviders();
    assert.equal(enabled.length, 1);
    assert.equal(enabled[0].id, 'enabled-1');
  });

  it('obfuscates the API key round-trip through storage (mirrors instance password handling)', () => {
    const provider: TorrentProvider = {
      apiKey: 'super-secret-key',
      id: 'prov-secret',
      isEnabled: true,
      name: 'Secure Provider',
      type: 'jackett',
      url: 'https://secure.example.com',
    };

    ProviderManager.addProvider(provider);

    const rawSaved = storageMap.get('torrplay_providers');
    assert.ok(rawSaved);
    const parsedSaved = JSON.parse(rawSaved);
    const savedEntry = parsedSaved.find((candidate: any) => candidate.id === 'prov-secret');
    assert.ok(savedEntry);
    assert.notEqual(savedEntry.apiKey, 'super-secret-key');
    assert.ok(savedEntry.apiKey.startsWith('enc:v1:'));

    // Reload from storage and confirm the key deobfuscates back correctly.
    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();
    const reloaded = ProviderManager.getProviders().find(candidate => candidate.id === 'prov-secret');
    assert.equal(reloaded?.apiKey, 'super-secret-key');
  });

  it('strips runtime-only status/latency before persisting', () => {
    const provider: TorrentProvider = {
      id: 'prov-ephemeral',
      isEnabled: true,
      latencyMs: 42,
      name: 'Node',
      status: 'online',
      type: 'jackett',
      url: 'http://node.example.com',
    };

    ProviderManager.addProvider(provider);

    const rawSaved = storageMap.get('torrplay_providers');
    const parsedSaved = JSON.parse(rawSaved);
    const savedEntry = parsedSaved.find((candidate: any) => candidate.id === 'prov-ephemeral');
    assert.equal(savedEntry.status, 'unknown');
    assert.equal(savedEntry.latencyMs, undefined);
  });

  it('syncs the primary provider of each type to legacy Lampa storage keys', () => {
    ProviderManager.addProvider({
      apiKey: 'jackett-key', id: 'j1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local',
    });
    ProviderManager.addProvider({
      apiKey: 'prowlarr-key', id: 'p1', isEnabled: true, name: 'Prowlarr', type: 'prowlarr', url: 'http://prowlarr.local',
    });

    assert.equal(storageMap.get('jackett_url'), 'http://jackett.local');
    assert.equal(storageMap.get('jackett_key'), 'jackett-key');
    assert.equal(storageMap.get('prowlarr_url'), 'http://prowlarr.local');
    assert.equal(storageMap.get('prowlarr_key'), 'prowlarr-key');
    assert.equal(storageMap.get('parser_use'), true);
  });

  it('resynchronizes legacy Lampa keys from the saved pool during startup', () => {
    ProviderManager.addProvider({
      apiKey: 'startup-key', id: 'j1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://startup.local',
    });
    storageMap.set('jackett_key', 'stale-key');
    storageMap.set('jackett_url', 'http://stale.local');

    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();

    assert.equal(storageMap.get('jackett_key'), 'startup-key');
    assert.equal(storageMap.get('jackett_url'), 'http://startup.local');
  });

  it('preserves native Lampa provider settings when the TorrPlay pool is empty', () => {
    storageMap.set('jackett_key', 'native-key');
    storageMap.set('jackett_url', 'http://native.local');

    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();

    assert.equal(storageMap.get('jackett_key'), 'native-key');
    assert.equal(storageMap.get('jackett_url'), 'http://native.local');
  });

  it('does not sync a disabled provider as the legacy primary', () => {
    ProviderManager.addProvider({
      apiKey: 'k1', id: 'j1', isEnabled: false, name: 'Jackett', type: 'jackett', url: 'http://jackett.local',
    });

    assert.equal(storageMap.get('jackett_url'), '');
    assert.equal(storageMap.get('parser_use'), false);
  });

  it('clears legacy provider credentials when an enabled provider is removed', () => {
    ProviderManager.addProvider({
      apiKey: 'jackett-key', id: 'j1', isEnabled: true, name: 'Jackett', type: 'jackett', url: 'http://jackett.local',
    });

    ProviderManager.removeProvider('j1');

    assert.equal(storageMap.get('jackett_key'), '');
    assert.equal(storageMap.get('jackett_url'), '');
    assert.equal(storageMap.get('parser_torrent_type'), '');
    assert.equal(storageMap.get('parser_use'), false);
  });

  it('pings all providers in parallel and records latency/status', async () => {
    ProviderManager.addProvider({
      apiKey: 'k', id: 'online-1', isEnabled: true, name: 'Online', type: 'jackett', url: 'http://online.example.com',
    });
    ProviderManager.addProvider({
      apiKey: 'k', id: 'offline-1', isEnabled: true, name: 'Offline', type: 'jackett', url: 'http://offline.example.com',
    });

    globalThis.fetch = async (input: RequestInfo | URL) => {
      if (String(input).includes('online.example.com')) {
        return new Response(JSON.stringify({ Results: [] }), { status: 200 });
      }
      throw new Error('Connection refused');
    };

    await ProviderManager.pingAll();

    const providers = ProviderManager.getProviders();
    assert.equal(providers.find(p => p.id === 'online-1')?.status, 'online');
    assert.equal(providers.find(p => p.id === 'offline-1')?.status, 'offline');
  });

  it('surfaces a notice and drops the API key when a stored credential cannot be deobfuscated', () => {
    storageMap.set('torrplay_providers', JSON.stringify([
      {
        apiKey: 'not-a-valid-obfuscated-value',
        id: 'corrupt-1',
        isEnabled: true,
        name: 'Corrupt Provider',
        type: 'jackett',
        url: 'http://corrupt.example.com',
      },
    ]));

    let notified = false;
    (globalThis as any).Lampa.Noty.show = () => { notified = true; };

    (ProviderManager as any).isInitialized = false;
    (ProviderManager as any).providers = [];
    ProviderManager.init();

    assert.equal(notified, true);
    const reloaded = ProviderManager.getProviders().find(candidate => candidate.id === 'corrupt-1');
    assert.equal(reloaded?.apiKey, '');
  });
});
