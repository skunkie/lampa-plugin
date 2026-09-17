// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { requestHttp } from '../api/http-client';
import { translate } from '../lang/translations';
import { ProviderHealthResult, TorrentProvider } from '../types/provider';
import { deobfuscateCredential, obfuscateCredential } from '../utils/storage-obfuscation';

export const GLOBAL_SEARCH_ENABLED_STORAGE_KEY = 'torrplay_search_in_global';
export const STORAGE_KEY_PROVIDERS = 'torrplay_providers';

/**
 * Reuses each provider's native search endpoint (see provider-search.ts) with an
 * empty query as a lightweight connectivity + API key check, rather than a separate
 * endpoint — matching what Lampa's own bundled Jackett/Prowlarr clients expose.
 */
function buildHealthCheckUrl(provider: TorrentProvider): string {
  const baseUrl = provider.url.replace(/\/+$/, '');
  const apiKey = encodeURIComponent(provider.apiKey || '');
  if (provider.type === 'prowlarr') {
    return `${baseUrl}/api/v1/search?apikey=${apiKey}&query=`;
  }
  return `${baseUrl}/api/v2.0/indexers/all/results?apikey=${apiKey}&Query=`;
}

export class ProviderManager {
  private static isInitialized = false;
  private static providers: TorrentProvider[] = [];

  public static init(): void {
    if (this.isInitialized) return;
    this.load();
    this.isInitialized = true;
    if (this.providers.length > 0) this.syncLegacyLampaKeys();
  }

  public static load(): TorrentProvider[] {
    const storedProviders = Lampa.Storage.get(STORAGE_KEY_PROVIDERS, '[]');
    try {
      const rawProviders = typeof storedProviders === 'string' ? JSON.parse(storedProviders) : storedProviders;
      if (Array.isArray(rawProviders)) {
        const unreadableCredentialProviders: string[] = [];
        this.providers = (rawProviders as Array<TorrentProvider & { latencyMs?: number }>).map(
          ({ latencyMs: _latency, ...provider }) => {
            let apiKey = provider.apiKey;
            if (apiKey !== undefined) {
              const deobfuscated = deobfuscateCredential(apiKey);
              if (apiKey !== '' && deobfuscated === '') {
                unreadableCredentialProviders.push(provider.name || provider.url || 'Provider');
              }
              apiKey = deobfuscated;
            }
            return {
              ...provider,
              ...(apiKey !== undefined ? { apiKey } : {}),
              status: 'unknown' as const,
            };
          }
        );

        if (unreadableCredentialProviders.length > 0 && typeof Lampa !== 'undefined' && Lampa.Noty?.show) {
          const names = unreadableCredentialProviders.join(', ');
          Lampa.Noty.show(
            translate(
              'torrplay_provider_invalid_credentials_noty',
              `TorrPlay: Saved API keys for ${names} could not be read. Please re-enter them in Settings.`,
              { names }
            )
          );
        }
      } else {
        this.providers = [];
      }
    } catch {
      this.providers = [];
    }

    return this.providers;
  }

  public static save(): void {
    // API keys are obfuscated before persisting, mirroring InstanceManager's password
    // handling. Runtime-only status/latency are stripped, matching its ephemeral fields.
    const sanitized = this.providers.map(provider => {
      const persisted: TorrentProvider = {
        ...(provider.apiKey !== undefined ? { apiKey: obfuscateCredential(provider.apiKey) } : {}),
        id: provider.id,
        isEnabled: provider.isEnabled,
        name: provider.name,
        status: 'unknown' as const,
        type: provider.type,
        url: provider.url,
      };
      return persisted;
    });

    Lampa.Storage.set(STORAGE_KEY_PROVIDERS, JSON.stringify(sanitized));
    this.syncLegacyLampaKeys();
  }

  public static getProviders(): TorrentProvider[] {
    if (!this.isInitialized) this.init();
    return this.providers;
  }

  public static getEnabledProviders(): TorrentProvider[] {
    return this.getProviders().filter(provider => provider.isEnabled);
  }

  public static addProvider(provider: TorrentProvider): void {
    this.providers.push(provider);
    this.save();
  }

  public static updateProvider(provider: TorrentProvider): void {
    const providerIndex = this.providers.findIndex(candidate => candidate.id === provider.id);
    if (providerIndex !== -1) {
      this.providers[providerIndex] = provider;
      this.save();
    }
  }

  public static removeProvider(id: string): void {
    this.providers = this.providers.filter(provider => provider.id !== id);
    this.save();
  }

  /**
   * Health check and latency measurement for a single provider.
   */
  public static async checkHealth(provider: TorrentProvider, timeoutMs = 8000): Promise<ProviderHealthResult> {
    const startedAtMs = performance.now();
    try {
      const response = await requestHttp(buildHealthCheckUrl(provider), {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        method: 'GET',
        timeoutMs,
      });
      const latencyMs = Math.round(performance.now() - startedAtMs);

      if (response.ok) {
        provider.status = 'online';
        provider.latencyMs = latencyMs;
        return { isOk: true, latencyMs };
      }
      provider.status = 'offline';
      provider.latencyMs = Infinity;
      return { isOk: false, statusMessage: response.statusText };
    } catch (error) {
      provider.status = 'offline';
      provider.latencyMs = Infinity;
      return { isOk: false, statusMessage: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Pings all providers in parallel and measures latency.
   */
  public static async pingAll(): Promise<TorrentProvider[]> {
    const providers = this.getProviders();
    if (providers.length === 0) return [];

    await Promise.all(
      providers.map(async provider => {
        provider.status = 'checking';
        await this.checkHealth(provider);
      })
    );

    this.save();
    return providers;
  }

  /**
   * Syncs the primary provider of each type to Lampa's native legacy storage keys, so
   * external scripts/plugins reading them directly keep working. Written in plaintext,
   * matching how stock Lampa itself stores them.
   */
  private static syncLegacyLampaKeys(): void {
    if (typeof Lampa === 'undefined' || !Lampa.Storage) return;

    const jackett = this.providers.find(provider => provider.type === 'jackett' && provider.isEnabled);
    const prowlarr = this.providers.find(provider => provider.type === 'prowlarr' && provider.isEnabled);

    if (jackett) {
      Lampa.Storage.set('jackett_url', jackett.url);
      Lampa.Storage.set('jackett_key', jackett.apiKey || '');
    } else {
      Lampa.Storage.set('jackett_url', '');
      Lampa.Storage.set('jackett_key', '');
    }
    if (prowlarr) {
      Lampa.Storage.set('prowlarr_url', prowlarr.url);
      Lampa.Storage.set('prowlarr_key', prowlarr.apiKey || '');
    } else {
      Lampa.Storage.set('prowlarr_url', '');
      Lampa.Storage.set('prowlarr_key', '');
    }

    const primary = jackett || prowlarr;
    if (primary) {
      Lampa.Storage.set('parser_torrent_type', primary.type);
    } else {
      Lampa.Storage.set('parser_torrent_type', '');
    }
    Lampa.Storage.set('parser_use', this.providers.some(provider => provider.isEnabled));
  }
}
