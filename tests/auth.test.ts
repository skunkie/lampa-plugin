// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { AuthManager } from '../src/api/auth';
import { TorrPlayInstance } from '../src/types/torrplay';

describe('AuthManager', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('generates correct Basic auth header value', () => {
    assert.equal(AuthManager.getBasicAuthHeader(), '');
    assert.equal(AuthManager.getBasicAuthHeader('', ''), '');

    const header = AuthManager.getBasicAuthHeader('admin', 'secret123');
    const expected = 'Basic ' + Buffer.from('admin:secret123').toString('base64');
    assert.equal(header, expected);
  });

  it('encodes Unicode Basic auth credentials as UTF-8', () => {
    const header = AuthManager.getBasicAuthHeader('юрий', 'пароль');
    const expected = 'Basic ' + Buffer.from('юрий:пароль', 'utf8').toString('base64');
    assert.equal(header, expected);
  });

  it('resolves auth headers for "none" auth mode', async () => {
    const instance: TorrPlayInstance = {
      id: 'inst-none',
      name: 'Test',
      url: 'http://localhost:8090',
      authType: 'none',
    };

    const headers = await AuthManager.getAuthHeaders(instance);
    assert.equal(headers['X-Requested-With'], 'XMLHttpRequest');
    assert.equal(headers['Authorization'], undefined);
  });

  it('resolves auth headers for "basic" auth mode', async () => {
    const instance: TorrPlayInstance = {
      id: 'inst-basic',
      name: 'Test',
      url: 'http://localhost:8090',
      authType: 'basic',
      username: 'user',
      password: 'pass',
    };

    const headers = await AuthManager.getAuthHeaders(instance);
    assert.equal(headers['X-Requested-With'], 'XMLHttpRequest');
    assert.equal(headers['Authorization'], 'Basic ' + Buffer.from('user:pass').toString('base64'));
  });

  it('acquires JWT token via /oauth/token for "bearer" auth mode', async () => {
    const instance: TorrPlayInstance = {
      id: 'inst-bearer',
      name: 'Test',
      url: 'http://localhost:8090',
      authType: 'bearer',
      username: 'admin',
      password: 'secretpassword',
    };

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(input);
      assert.ok(requestUrl.endsWith('/oauth/token'), 'Should call /oauth/token');
      assert.equal(init?.method, 'POST');
      assert.ok(String(init?.body).includes('username=admin'));
      assert.ok(String(init?.body).includes('password=secretpassword'));

      return new Response(JSON.stringify({
        access_token: 'mock-jwt-token-12345',
        token_type: 'Bearer',
        expires_in: 3600,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const token = await AuthManager.loginBearer(instance);
    assert.equal(token, 'mock-jwt-token-12345');
    assert.equal(instance.jwtToken, 'mock-jwt-token-12345');
    assert.ok(instance.jwtExpiresAtMs && instance.jwtExpiresAtMs > Date.now());

    const headers = await AuthManager.getAuthHeaders(instance);
    assert.equal(headers['Authorization'], 'Bearer mock-jwt-token-12345');
  });

  it('obtains playback-scoped token via /api/v1/tokens', async () => {
    const instance: TorrPlayInstance = {
      id: 'inst-token',
      name: 'Test',
      url: 'http://localhost:8090',
      authType: 'basic',
      username: 'admin',
      password: 'secretpassword',
    };

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(input);
      assert.ok(requestUrl.endsWith('/api/v1/tokens'), 'Should call /api/v1/tokens');
      assert.equal(init?.method, 'POST');
      const requestBody = JSON.parse(String(init?.body));
      assert.equal(requestBody.scope, 'playback');

      return new Response(JSON.stringify({
        token: 'playback-token-abcdef',
        scope: 'playback',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const token = await AuthManager.getPlaybackToken(instance);
    assert.equal(token, 'playback-token-abcdef');
    assert.equal(instance.playbackToken, 'playback-token-abcdef');
  });
});
