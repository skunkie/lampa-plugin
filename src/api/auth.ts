// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import { ScopedToken, TokenResponse, TorrPlayInstance } from '../types/torrplay';
import { requestHttp } from './http-client';

export class AuthManager {
  /**
   * Encodes username and password into a standard HTTP Basic Auth header value.
   */
  public static getBasicAuthHeader(username?: string, password?: string): string {
    if (!username && !password) return '';
    const credentials = `${username || ''}:${password || ''}`;
    try {
      const utf8Credentials = unescape(encodeURIComponent(credentials));
      return `Basic ${btoa(utf8Credentials)}`;
    } catch {
      return '';
    }
  }

  /**
   * Acquires a new JWT access token using Resource Owner Password Credentials Grant via /oauth/token.
   */
  public static async loginBearer(instance: TorrPlayInstance): Promise<string> {
    if (!instance.username || !instance.password) {
      throw new Error('Username and password required for Bearer authentication');
    }

    const loginForm = new URLSearchParams({
      grant_type: 'password',
      password: instance.password,
      username: instance.username,
    });

    const url = `${instance.url.replace(/\/+$/, '')}/oauth/token`;
    const response = await requestHttp(url, {
      body: loginForm.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Bearer auth failed (${response.status}): ${response.statusText || 'Unauthorized'}`);
    }

    const tokenResponse = (await response.json()) as TokenResponse;
    instance.jwtToken = tokenResponse.access_token;
    // Set expiration with 60s safety buffer
    const expiresInSeconds = tokenResponse.expires_in || 86400;
    instance.jwtExpiresAtMs = Date.now() + expiresInSeconds * 1000 - 60000;

    return tokenResponse.access_token;
  }

  /**
   * Ensures the instance has a valid JWT token if Bearer auth is used.
   */
  public static async ensureBearerToken(instance: TorrPlayInstance): Promise<string> {
    if (instance.jwtToken && instance.jwtExpiresAtMs && Date.now() < instance.jwtExpiresAtMs) {
      return instance.jwtToken;
    }
    return this.loginBearer(instance);
  }

  /**
   * Resolves authentication headers for API requests according to the instance auth type.
   */
  public static async getAuthHeaders(instance: TorrPlayInstance): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (instance.authType === 'basic') {
      const basicAuthHeader = this.getBasicAuthHeader(instance.username, instance.password);
      if (basicAuthHeader) headers['Authorization'] = basicAuthHeader;
    } else if (instance.authType === 'bearer') {
      const token = await this.ensureBearerToken(instance);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Obtains a playback token via POST /api/v1/tokens with scope 'playback'.
   */
  public static async getPlaybackToken(instance: TorrPlayInstance, shouldForceRefresh = false): Promise<string> {
    if (instance.authType === 'none') {
      return '';
    }

    if (
      !shouldForceRefresh
      && instance.playbackToken
      && instance.playbackTokenExpiresAtMs
      && Date.now() < instance.playbackTokenExpiresAtMs
    ) {
      return instance.playbackToken;
    }

    const authHeaders = await this.getAuthHeaders(instance);
    const url = `${instance.url.replace(/\/+$/, '')}/api/v1/tokens`;

    const response = await requestHttp(url, {
      body: JSON.stringify({ scope: 'playback' }),
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      // If unauthorized on bearer, try re-authenticating once
      if (response.status === 401 && instance.authType === 'bearer' && !shouldForceRefresh) {
        instance.jwtToken = undefined;
        return this.getPlaybackToken(instance, true);
      }
      throw new Error(
        `Failed to obtain playback token (${response.status}): ${response.statusText || 'Unauthorized'}`
      );
    }

    const tokenResponse = (await response.json()) as ScopedToken;
    instance.playbackToken = tokenResponse.token;
    const expiresAtMs = new Date(tokenResponse.expires_at).getTime();
    instance.playbackTokenExpiresAtMs = isNaN(expiresAtMs)
      ? Date.now() + 86400000 - 60000
      : expiresAtMs - 60000;

    return tokenResponse.token;
  }
}
