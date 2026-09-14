// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { requestHttp } from '../src/api/http-client';

describe('HTTP Client (requestHttp)', () => {
  const originalFetch = globalThis.fetch;
  const originalLampa = (globalThis as any).Lampa;

  beforeEach(() => {
    delete (globalThis as any).Lampa;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalLampa) {
      (globalThis as any).Lampa = originalLampa;
    } else {
      delete (globalThis as any).Lampa;
    }
  });

  it('uses fetch fallback when Lampa.Reguest is absent', async () => {
    let capturedRequestUrl = '';
    let capturedRequestOptions: RequestInit | undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedRequestUrl = String(input);
      capturedRequestOptions = init;
      return new Response(JSON.stringify({ hello: 'world' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
        statusText: 'OK',
      });
    };

    const response = await requestHttp('http://127.0.0.1:8090/api/system/health', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      method: 'GET',
    });

    assert.equal(capturedRequestUrl, 'http://127.0.0.1:8090/api/system/health');
    assert.equal(capturedRequestOptions?.method, 'GET');
    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.equal(response.statusText, 'OK');
    const responseBody = await response.json();
    assert.deepEqual(responseBody, { hello: 'world' });
    const responseText = await response.text();
    assert.equal(responseText, JSON.stringify({ hello: 'world' }));
  });

  it('delegates to Lampa.Reguest when available', async () => {
    let configuredTimeoutMs = 0;
    let capturedSilentCall: any = null;

    class MockReguest {
      public timeout(timeoutMs: number) {
        configuredTimeoutMs = timeoutMs;
      }
      public silent(
        url: string,
        onSuccess: (responseBody: any) => void,
        _onFailure: (error: any) => void,
        requestBody: any,
        requestOptions: any
      ) {
        capturedSilentCall = { requestBody, requestOptions, url };
        onSuccess(JSON.stringify({ status: 'healthy' }));
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguest,
    };

    const response = await requestHttp('http://127.0.0.1:8090/api/system/health', {
      body: JSON.stringify({ test: 123 }),
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      method: 'POST',
      timeoutMs: 5000,
    });

    assert.equal(configuredTimeoutMs, 5000);
    assert.equal(capturedSilentCall.url, 'http://127.0.0.1:8090/api/system/health');
    assert.equal(capturedSilentCall.requestBody, JSON.stringify({ test: 123 }));
    assert.equal(capturedSilentCall.requestOptions.type, 'POST');
    assert.equal(capturedSilentCall.requestOptions.crossDomain, true);
    assert.equal(capturedSilentCall.requestOptions.contentType, 'application/json');

    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    assert.equal(response.statusText, 'OK');
    const responseBody = await response.json();
    assert.deepEqual(responseBody, { status: 'healthy' });
  });

  it('synthesizes status 204 No Content for empty bodies on Lampa.Reguest success path', async () => {
    class MockReguest {
      public timeout(_timeoutMs: number) {}
      public silent(
        _url: string,
        onSuccess: (responseBody: any) => void,
        _onFailure: (error: any) => void
      ) {
        onSuccess('');
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguest,
    };

    const response = await requestHttp('http://127.0.0.1:8090/api/v1/preload');
    assert.equal(response.ok, true);
    assert.equal(response.status, 204);
    assert.equal(response.statusText, 'No Content');
    const responseText = await response.text();
    assert.equal(responseText, '');
  });

  it('handles HTTP error status from Lampa.Reguest reject callback', async () => {
    class MockReguest {
      public timeout(_timeoutMs: number) {}
      public silent(
        _url: string,
        _onSuccess: (responseBody: any) => void,
        onFailure: (error: any) => void
      ) {
        onFailure({
          responseText: JSON.stringify({ error: 'not found' }),
          status: 404,
          statusText: 'Not Found',
        });
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguest,
    };

    const response = await requestHttp('http://127.0.0.1:8090/api/v1/torrents/unknown');
    assert.equal(response.ok, false);
    assert.equal(response.status, 404);
    assert.equal(response.statusText, 'Not Found');
    const responseBody = await response.json();
    assert.deepEqual(responseBody, { error: 'not found' });
  });

  it('rejects on network error (status 0) from Lampa.Reguest', async () => {
    class MockReguest {
      public timeout(_timeoutMs: number) {}
      public silent(
        _url: string,
        _onSuccess: (responseBody: any) => void,
        onFailure: (error: any) => void
      ) {
        onFailure({
          responseText: '',
          status: 0,
        });
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguest,
    };

    await assert.rejects(
      async () => {
        await requestHttp('http://127.0.0.1:8090/api/system/health');
      },
      /Network error/
    );
  });

  it('delegates to Lampa.Reguest.native when available', async () => {
    let capturedNativeCall: any = null;

    class MockReguestWithNative {
      public timeout(_timeoutMs: number) {}
      public native(
        url: string,
        onSuccess: (responseBody: any) => void,
        _onFailure: (error: any) => void,
        requestBody: any,
        requestOptions: any
      ) {
        capturedNativeCall = { requestBody, requestOptions, url };
        onSuccess(JSON.stringify({ status: 'ok' }));
      }
      public silent() {
        throw new Error('Should not call silent when native is available');
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguestWithNative,
    };

    const response = await requestHttp('http://127.0.0.1:8090/api/v1/torrents', {
      method: 'POST',
    });

    assert.equal(capturedNativeCall.url, 'http://127.0.0.1:8090/api/v1/torrents');
    assert.equal(capturedNativeCall.requestBody, '{}');
    assert.equal(capturedNativeCall.requestOptions.type, 'POST');
    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { status: 'ok' });
  });

  it('sends PATCH/DELETE through the native bridge as POST with X-HTTP-Method-Override', async () => {
    // Lampa Android's native httpReq bridge ignores the intended verb entirely: it
    // sends GET when there is no body and POST when there is one (see AndroidJS.kt).
    // A real PUT/PATCH/DELETE must be smuggled through as POST + an override header.
    let capturedNativeCall: any = null;

    class MockReguestWithNative {
      public timeout(_timeoutMs: number) {}
      public native(
        url: string,
        onSuccess: (responseBody: any) => void,
        _onFailure: (error: any) => void,
        requestBody: any,
        requestOptions: any
      ) {
        capturedNativeCall = { requestBody, requestOptions, url };
        onSuccess(JSON.stringify({ status: 'updated' }));
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguestWithNative,
    };

    const responsePatch = await requestHttp('http://127.0.0.1:8090/api/v1/torrents/abcdef', {
      body: JSON.stringify({ storage: 'file' }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    });

    assert.equal(capturedNativeCall.requestOptions.type, 'POST');
    assert.equal(capturedNativeCall.requestOptions.headers['X-HTTP-Method-Override'], 'PATCH');
    assert.equal(capturedNativeCall.requestOptions.contentType, 'application/json');
    assert.equal(responsePatch.ok, true);
    assert.equal(responsePatch.status, 200);

    const responseDelete = await requestHttp('http://127.0.0.1:8090/api/v1/torrents/abcdef', {
      method: 'DELETE',
    });

    assert.equal(capturedNativeCall.requestOptions.type, 'POST');
    assert.equal(capturedNativeCall.requestOptions.headers['X-HTTP-Method-Override'], 'DELETE');
    // A bodyless DELETE must still carry a body, otherwise the bridge's own
    // GET-vs-POST check (body present or not) would send it as a GET.
    assert.equal(capturedNativeCall.requestBody, '{}');
    assert.equal(responseDelete.ok, true);
    assert.equal(responseDelete.status, 200);
  });

  it('sends the real PUT/DELETE verb (no override) through the ajax fallback transport', async () => {
    let capturedSilentCall: any = null;

    // The fallback only runs when native() throws/hangs outright (e.g. no bridge
    // present), not when it resolves with an error status like the 404 a
    // mis-routed POST would get — that resolved response is returned as-is.
    class MockReguestNativeThrows {
      public timeout(_timeoutMs: number) {}
      public native() {
        throw new Error('native bridge unavailable');
      }
      public silent(
        url: string,
        onSuccess: (responseBody: any) => void,
        _onFailure: (error: any) => void,
        requestBody: any,
        requestOptions: any
      ) {
        capturedSilentCall = { requestBody, requestOptions, url };
        onSuccess(JSON.stringify({ status: 'ready' }));
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguestNativeThrows,
    };

    const response = await requestHttp('http://127.0.0.1:8090/api/v1/torrents/abcdef/preload', {
      body: JSON.stringify({ file_index: 0 }),
      method: 'PUT',
    });

    assert.equal(capturedSilentCall.requestOptions.type, 'PUT');
    assert.equal(capturedSilentCall.requestOptions.headers['X-HTTP-Method-Override'], undefined);
    assert.equal(response.ok, true);
  });

  it('does not repeat a mutating native request through silent after an asynchronous failure', async () => {
    let silentCallCount = 0;

    class MockReguestNativeFailsAsynchronously {
      public timeout(_timeoutMs: number) {}
      public native(
        _url: string,
        _onSuccess: (responseBody: any) => void,
        onFailure: (error: any) => void
      ) {
        queueMicrotask(() => onFailure({ status: 0 }));
      }
      public silent() {
        silentCallCount++;
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguestNativeFailsAsynchronously,
    };

    await assert.rejects(
      requestHttp('http://127.0.0.1:8090/api/v1/torrents/abcdef', {
        method: 'DELETE',
      }),
      /Network error/
    );
    assert.equal(silentCallCount, 0);
  });

  it('handles Android bridge error format ({ status: 401, message: "..." })', async () => {
    class MockReguestWithNative {
      public timeout(_timeoutMs: number) {}
      public native(
        _url: string,
        _onSuccess: (responseBody: any) => void,
        onFailure: (error: any) => void
      ) {
        onFailure({
          message: 'request error: Invalid response from server: 401 Unauthorized',
          status: 401,
        });
      }
    }

    (globalThis as any).Lampa = {
      Reguest: MockReguestWithNative,
    };

    const response = await requestHttp('http://127.0.0.1:8090/api/v1/torrents');
    assert.equal(response.ok, false);
    assert.equal(response.status, 401);
    assert.equal(response.statusText, 'request error: Invalid response from server: 401 Unauthorized');
    const responseText = await response.text();
    assert.equal(responseText, 'request error: Invalid response from server: 401 Unauthorized');
  });
});
