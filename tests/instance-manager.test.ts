// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { InstanceManager } from '../src/instances/instance-manager';
import { TorrPlayInstance } from '../src/types/torrplay';

describe('InstanceManager', () => {
  const originalFetch = globalThis.fetch;
  const storageMap = new Map<string, any>();

  beforeEach(() => {
    storageMap.clear();
    (globalThis as any).Lampa = {
      Storage: {
        get: (key: string, defaultValue: any) => (
          storageMap.has(key) ? storageMap.get(key) : defaultValue
        ),
        set: (key: string, value: any) => storageMap.set(key, value),
      },
      Noty: {
        show: () => {},
      },
    };
    (InstanceManager as any).isInitialized = false;
    (InstanceManager as any).instances = [];
    InstanceManager.init();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('manages instance lifecycle (add, update, remove)', () => {
    const newInstance: TorrPlayInstance = {
      authType: 'none',
      id: 'inst-1',
      name: 'VPS Instance',
      url: 'http://vps.example.com:8090',
    };

    InstanceManager.addInstance(newInstance);
    let instances = InstanceManager.getInstances();
    assert.ok(instances.some(instance => instance.id === 'inst-1'));

    newInstance.name = 'Updated VPS';
    InstanceManager.updateInstance(newInstance);
    instances = InstanceManager.getInstances();
    assert.equal(instances.find(instance => instance.id === 'inst-1')?.name, 'Updated VPS');

    InstanceManager.removeInstance('inst-1');
    instances = InstanceManager.getInstances();
    assert.ok(!instances.some(instance => instance.id === 'inst-1'));
  });

  it('sanitizes ephemeral tokens and benchmarks when persisting to storage', () => {
    const instanceWithTokens: TorrPlayInstance = {
      authType: 'bearer',
      id: 'inst-tokens',
      jwtExpiresAtMs: Date.now() + 60000,
      jwtToken: 'secret-jwt-token',
      latencyMs: 42,
      name: 'Secure Node',
      password: 'mypassword',
      playbackToken: 'secret-playback-token',
      playbackTokenExpiresAtMs: Date.now() + 60000,
      status: 'online',
      url: 'https://secure.example.com',
      username: 'myuser',
    };

    InstanceManager.addInstance(instanceWithTokens);

    // Verify in-memory instance retains tokens for current session
    const inMemory = InstanceManager.getInstances().find(i => i.id === 'inst-tokens');
    assert.equal(inMemory?.jwtToken, 'secret-jwt-token');
    assert.equal(inMemory?.playbackToken, 'secret-playback-token');

    // Verify persistent storage JSON does NOT contain any secret tokens or benchmarks
    const rawSaved = storageMap.get('torrplay_instances');
    assert.ok(rawSaved);
    const parsedSaved = JSON.parse(rawSaved);
    const savedEntry = parsedSaved.find((i: any) => i.id === 'inst-tokens');
    assert.ok(savedEntry);
    assert.equal(savedEntry.jwtToken, undefined);
    assert.equal(savedEntry.jwtExpiresAtMs, undefined);
    assert.equal(savedEntry.playbackToken, undefined);
    assert.equal(savedEntry.playbackTokenExpiresAtMs, undefined);
    assert.equal(savedEntry.latencyMs, undefined);
    assert.equal(savedEntry.status, 'unknown');
    assert.equal(savedEntry.username, 'myuser');
    assert.ok(savedEntry.password.startsWith('enc:v1:'));
    assert.notEqual(savedEntry.password, 'mypassword');

    // Verify loading restores the decrypted password in-memory
    (InstanceManager as any).instances = [];
    const reloaded = InstanceManager.load();
    const reloadedEntry = reloaded.find(i => i.id === 'inst-tokens');
    assert.equal(reloadedEntry?.password, 'mypassword');

    // Verify un-obfuscated plain or corrupted passwords trigger a single batched warning notification
    const notyCalls: string[] = [];
    (globalThis as any).Lampa.Noty.show = (msg: string) => {
      notyCalls.push(msg);
    };

    storageMap.set(
      'torrplay_instances',
      JSON.stringify([
        {
          authType: 'basic',
          id: 'unobfuscated-inst-1',
          name: 'Corrupted Node 1',
          password: 'plainLegacyPassword123',
          status: 'unknown',
          url: 'http://node1.example.com',
          username: 'admin',
        },
        {
          authType: 'bearer',
          id: 'unobfuscated-inst-2',
          name: 'Corrupted Node 2',
          password: 'anotherPlainPassword456',
          status: 'unknown',
          url: 'http://node2.example.com',
          username: 'admin',
        },
        {
          authType: 'none',
          id: 'valid-none-inst',
          name: 'Valid Public Node',
          status: 'unknown',
          url: 'http://public.example.com',
        },
      ])
    );

    const unobfuscatedReloaded = InstanceManager.load();
    const entry1 = unobfuscatedReloaded.find(i => i.id === 'unobfuscated-inst-1');
    const entry2 = unobfuscatedReloaded.find(i => i.id === 'unobfuscated-inst-2');
    assert.equal(entry1?.password, '');
    assert.equal(entry2?.password, '');

    // Assert that exactly one notification was fired containing both affected instance names
    assert.equal(notyCalls.length, 1);
    assert.ok(notyCalls[0].includes('Corrupted Node 1'));
    assert.ok(notyCalls[0].includes('Corrupted Node 2'));
    assert.ok(!notyCalls[0].includes('Valid Public Node'));
  });

  it('resolves primary instance dynamically based on selection mode and latency', () => {
    const firstInstance: TorrPlayInstance = {
      authType: 'none',
      id: 'inst-first',
      latencyMs: 120,
      name: 'First Instance',
      status: 'online',
      url: 'http://first.example.com:8090',
    };
    const fastInstance: TorrPlayInstance = {
      authType: 'none',
      id: 'inst-fast',
      latencyMs: 15,
      name: 'Fast Instance',
      status: 'online',
      url: 'http://fast.example.com:8090',
    };

    (InstanceManager as any).instances = [firstInstance, fastInstance];

    // In auto mode, primary instance resolves to lowest latency online node
    InstanceManager.setMode('auto');
    assert.equal(InstanceManager.getPrimaryInstance().id, 'inst-fast');

    // In manual mode, primary instance resolves to selectedId
    InstanceManager.setMode('manual');
    InstanceManager.setSelectedId('inst-first');
    assert.equal(InstanceManager.getPrimaryInstance().id, 'inst-first');
  });

  it('manages primary instance retrieval and updates', () => {
    const primaryInstance = InstanceManager.getPrimaryInstance();
    assert.ok(primaryInstance);
    assert.ok(primaryInstance.url);

    InstanceManager.updatePrimaryInstance({
      authType: 'basic',
      url: 'http://custom-host:8090',
      username: 'user1',
    });

    const updatedInstance = InstanceManager.getPrimaryInstance();
    assert.equal(updatedInstance.url, 'http://custom-host:8090');
    assert.equal(updatedInstance.authType, 'basic');
    assert.equal(updatedInstance.username, 'user1');
  });

  it('keeps manual selection valid when entering manual mode and deleting an instance', () => {
    const first: TorrPlayInstance = {
      authType: 'none',
      id: 'first',
      name: 'First',
      url: 'http://first.local:8090',
    };
    const second: TorrPlayInstance = {
      authType: 'none',
      id: 'second',
      name: 'Second',
      url: 'http://second.local:8090',
    };

    (InstanceManager as any).instances = [first, second];
    InstanceManager.setMode('manual');
    InstanceManager.setSelectedId('first');

    InstanceManager.removeInstance('first');
    assert.equal(InstanceManager.getSelectedId(), 'second');
  });

  it('selects lowest-latency reachable instance in auto mode', async () => {
    const fastNode: TorrPlayInstance = {
      authType: 'none',
      id: 'fast-node',
      name: 'Fast Instance',
      url: 'http://fast.local:8090',
    };

    const slowNode: TorrPlayInstance = {
      authType: 'none',
      id: 'slow-node',
      name: 'Slow Instance',
      url: 'http://slow.local:8090',
    };

    InstanceManager.setMode('auto');
    InstanceManager.save();
    // Replace instances list
    (InstanceManager as any).instances = [slowNode, fastNode];
    InstanceManager.save();

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const requestUrl = String(input);
      if (requestUrl.includes('fast.local')) {
        return new Response(null, { status: 200 });
      }
      if (requestUrl.includes('slow.local')) {
        await new Promise(resolve => setTimeout(resolve, 60));
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 500 });
    };

    const bestInstance = await InstanceManager.getBestInstance();
    assert.equal(bestInstance.id, 'fast-node', 'Auto mode should pick fastest node');
  });

  it('triggers failover to next reachable instance when active instance is down', async () => {
    const failedNode: TorrPlayInstance = {
      authType: 'none',
      id: 'failed-node',
      name: 'Down Instance',
      url: 'http://down.local:8090',
    };

    const backupNode: TorrPlayInstance = {
      authType: 'none',
      id: 'backup-node',
      name: 'Backup Instance',
      url: 'http://backup.local:8090',
    };

    (InstanceManager as any).instances = [failedNode, backupNode];
    InstanceManager.save();

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const requestUrl = String(input);
      if (requestUrl.includes('down.local')) {
        throw new Error('Connection refused');
      }
      if (requestUrl.includes('backup.local')) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 500 });
    };

    const fallbackInstance = await InstanceManager.failover(failedNode);
    assert.ok(fallbackInstance !== null);
    assert.equal(fallbackInstance?.id, 'backup-node');
    assert.equal(failedNode.status, 'offline');
  });
});
