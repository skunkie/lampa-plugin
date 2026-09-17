// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { TorrPlayApi } from '../api/torrplay';
import { translate } from '../lang/translations';
import { TorrPlayInstance } from '../types/torrplay';
import { deobfuscateCredential, obfuscateCredential } from '../utils/storage-obfuscation';
import { generateUuid } from '../utils/uuid';

const STORAGE_KEY_INSTANCES = 'torrplay_instances';
const STORAGE_KEY_MODE = 'torrplay_selection_mode';
const STORAGE_KEY_SELECTED = 'torrplay_selected_instance';

export type SelectionMode = 'auto' | 'manual';

export class InstanceManager {
  private static instances: TorrPlayInstance[] = [];
  private static isInitialized = false;
  private static readonly selectionListeners: Array<() => void> = [];

  /**
   * Registers a listener for changes to which instance requests are sent to. Anything cached
   * per instance has to be dropped when that changes, and this is the only place that knows.
   */
  public static onSelectionChanged(listener: () => void): void {
    this.selectionListeners.push(listener);
  }

  private static notifySelectionChanged(): void {
    this.selectionListeners.forEach(listener => {
      try {
        listener();
      } catch {} // A listener that throws must not break instance selection itself.
    });
  }

  public static init(): void {
    if (this.isInitialized) return;
    this.load();
    this.isInitialized = true;
  }

  public static getMode(): SelectionMode {
    return (Lampa.Storage.get(STORAGE_KEY_MODE, 'auto') as SelectionMode) || 'auto';
  }

  public static setMode(mode: SelectionMode): void {
    const previousMode = this.getMode();
    Lampa.Storage.set(STORAGE_KEY_MODE, mode);

    if (mode === 'manual') {
      const instances = this.getInstances();
      const selectedInstance = instances.find(instance => instance.id === this.getSelectedId());
      if (!selectedInstance) {
        this.setSelectedId(instances[0]?.id || '');
      }
    }

    if (previousMode !== mode) this.notifySelectionChanged();
  }

  public static getSelectedId(): string {
    return Lampa.Storage.get(STORAGE_KEY_SELECTED, '');
  }

  public static setSelectedId(id: string): void {
    const previousId = this.getSelectedId();
    Lampa.Storage.set(STORAGE_KEY_SELECTED, id);
    if (previousId !== id) this.notifySelectionChanged();
  }

  public static load(): TorrPlayInstance[] {
    const storedInstances = Lampa.Storage.get(STORAGE_KEY_INSTANCES, '[]');
    try {
      const rawInstances = typeof storedInstances === 'string' ? JSON.parse(storedInstances) : storedInstances;
      if (Array.isArray(rawInstances)) {
        const unreadableCredentialInstances: string[] = [];
        this.instances = (rawInstances as TorrPlayInstance[]).map(
          ({
            jwtExpiresAtMs: _jwtExp,
            jwtToken: _jwt,
            latencyMs: _latency,
            playbackToken: _pbToken,
            playbackTokenExpiresAtMs: _pbExp,
            ...instance
          }) => {
            let password = instance.password;
            if (password !== undefined) {
              const deobfuscated = deobfuscateCredential(password);
              if (password !== '' && deobfuscated === '') {
                unreadableCredentialInstances.push(instance.name || instance.url || 'TorrPlay');
              }
              password = deobfuscated;
            }
            return {
              ...instance,
              ...(password !== undefined ? { password } : {}),
              status: 'unknown' as const,
            };
          }
        );

        if (unreadableCredentialInstances.length > 0 && typeof Lampa !== 'undefined' && Lampa.Noty?.show) {
          const names = unreadableCredentialInstances.join(', ');
          Lampa.Noty.show(
            translate(
              'torrplay_invalid_credentials_noty',
              `TorrPlay: Saved credentials for ${names} could not be read. Please re-enter the password in Settings.`,
              { names }
            )
          );
        }
      } else {
        this.instances = [];
      }
    } catch {
      this.instances = [];
    }

    // Default fallback if completely empty
    if (this.instances.length === 0) {
      this.instances = [
        {
          authType: 'none',
          id: generateUuid(),
          name: 'Local TorrPlay',
          status: 'unknown' as const,
          url: 'http://127.0.0.1:8090',
        },
      ];
      this.save();
    }

    return this.instances;
  }

  public static save(): void {
    // Ephemeral tokens (jwtToken, playbackToken) and runtime benchmarks (latencyMs)
    // are strictly kept in-memory to prevent persistent credential leakage in localStorage.
    // Stored passwords are obfuscated to prevent plaintext leakage in storage dumps.
    const sanitized = this.instances.map(instance => {
      const persisted: TorrPlayInstance = {
        authType: instance.authType,
        ...(instance.enableDownloader !== undefined ? { enableDownloader: instance.enableDownloader } : {}),
        ...(instance.fileStoragePath !== undefined ? { fileStoragePath: instance.fileStoragePath } : {}),
        id: instance.id,
        name: instance.name,
        ...(instance.password !== undefined ? { password: obfuscateCredential(instance.password) } : {}),
        status: 'unknown' as const,
        url: instance.url,
        ...(instance.username !== undefined ? { username: instance.username } : {}),
      };
      return persisted;
    });

    Lampa.Storage.set(STORAGE_KEY_INSTANCES, JSON.stringify(sanitized));
  }

  public static getInstances(): TorrPlayInstance[] {
    if (!this.isInitialized) this.init();
    return this.instances;
  }

  public static getPrimaryInstance(): TorrPlayInstance {
    const list = this.getInstances();
    if (list.length === 0) {
      return this.load()[0];
    }
    if (this.getMode() === 'auto') {
      const online = list.filter(instance => (
        instance.status === 'online' && instance.latencyMs !== undefined && instance.latencyMs < Infinity
      ));
      if (online.length > 0) {
        online.sort((a, b) => (a.latencyMs || 0) - (b.latencyMs || 0));
        return online[0];
      }
    }
    const selectedId = this.getSelectedId();
    return list.find(instance => instance.id === selectedId) || list[0];
  }

  public static addInstance(instance: TorrPlayInstance): void {
    this.instances.push(instance);
    this.save();
  }

  public static updateInstance(instance: TorrPlayInstance): void {
    const instanceIndex = this.instances.findIndex(candidate => candidate.id === instance.id);
    if (instanceIndex !== -1) {
      this.instances[instanceIndex] = instance;
      this.save();
    }
  }

  public static removeInstance(id: string): void {
    this.instances = this.instances.filter(instance => instance.id !== id);
    if (this.getSelectedId() === id) {
      this.setSelectedId(this.instances[0]?.id || '');
    } else {
      // Auto mode picks from the whole pool, so a removal reshapes the choice even when the
      // manually selected instance is untouched.
      this.notifySelectionChanged();
    }
    this.save();
  }

  /**
   * Pings all instances in parallel using /api/system/health and measures latency.
   */
  public static async pingAll(): Promise<TorrPlayInstance[]> {
    const instances = this.getInstances();
    if (instances.length === 0) return [];

    await Promise.all(
      instances.map(async instance => {
        instance.status = 'checking';
        await TorrPlayApi.checkHealth(instance);
      })
    );

    this.save();
    return instances;
  }

  /**
   * Resolves the best available TorrPlay instance according to selection mode and latency.
   */
  public static async getBestInstance(): Promise<TorrPlayInstance> {
    if (!this.isInitialized) this.init();
    const mode = this.getMode();
    const instances = this.instances;

    if (instances.length === 0) {
      throw new Error('No TorrPlay instances configured');
    }

    if (mode === 'manual') {
      const selectedId = this.getSelectedId();
      const selectedInstance = instances.find(instance => instance.id === selectedId) || instances[0];

      // Quick health verification
      const healthResult = await TorrPlayApi.checkHealth(selectedInstance, 2500);
      if (healthResult.isOk) {
        return selectedInstance;
      }

      // If manual instance is down, trigger failover
      const fallbackInstance = await this.failover(selectedInstance);
      if (fallbackInstance) return fallbackInstance;
      throw new Error(`Instance "${selectedInstance.name}" is offline and no fallbacks available`);
    }

    // Auto Mode: Ping all in parallel, sort by latency
    await this.pingAll();

    const reachableInstances = instances
      .filter(instance => (
        instance.status === 'online' && instance.latencyMs !== undefined && instance.latencyMs < Infinity
      ))
      .sort((first, second) => (first.latencyMs ?? 99999) - (second.latencyMs ?? 99999));

    if (reachableInstances.length > 0) {
      return reachableInstances[0];
    }

    throw new Error('All configured TorrPlay instances are unreachable');
  }

  /**
   * Failover to the next best available instance when an active instance goes offline.
   */
  public static async failover(failedInstance: TorrPlayInstance): Promise<TorrPlayInstance | null> {
    failedInstance.status = 'offline';
    failedInstance.latencyMs = Infinity;

    const remainingInstances = this.instances.filter(instance => instance.id !== failedInstance.id);
    if (remainingInstances.length === 0) return null;

    // Ping remaining instances concurrently
    await Promise.all(remainingInstances.map(instance => TorrPlayApi.checkHealth(instance, 2500)));

    const reachableInstances = remainingInstances
      .filter(instance => (
        instance.status === 'online' && instance.latencyMs !== undefined && instance.latencyMs < Infinity
      ))
      .sort((first, second) => (first.latencyMs ?? 99999) - (second.latencyMs ?? 99999));

    if (reachableInstances.length > 0) {
      const nextInstance = reachableInstances[0];
      if (typeof Lampa !== 'undefined' && Lampa.Noty) {
        Lampa.Noty.show(
          translate(
            'torrplay_noty_failover',
            `TorrPlay: ${failedInstance.name} offline → Switched to ${nextInstance.name} (${nextInstance.latencyMs} ms)`,
            {
              failed: failedInstance.name,
              latency: nextInstance.latencyMs ?? 0,
              next: nextInstance.name,
            }
          ),
          { time: 4000 }
        );
      }
      return nextInstance;
    }

    return null;
  }
}
