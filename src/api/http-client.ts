// SPDX-FileCopyrightText: 2026 TorrPlay
//
// SPDX-License-Identifier: MIT

interface HttpRequestOptions {
  body?: string,
  headers?: Record<string, string>,
  method?: string,
  signal?: AbortSignal,
  timeoutMs?: number
}

interface HttpResponse {
  json: () => Promise<unknown>,
  ok: boolean,
  status: number,
  statusText?: string,
  text: () => Promise<string>
}

interface LampaAjaxParams {
  contentType?: string,
  crossDomain: boolean,
  dataType: string,
  headers: Record<string, string>,
  timeout: number,
  type: string
}

interface LampaFailureResponse {
  message?: string,
  responseText?: string,
  status?: number,
  statusText?: string
}

// Lampa Android's native httpReq bridge (AndroidJS.kt/Http.java) never reads
// the intended HTTP verb at all: it always issues a GET when there is no
// request body and a POST when there is one. A PUT/PATCH/DELETE must be sent
// as a POST carrying this header, which the TorrPlay server rewrites to the
// real verb before routing.
const METHOD_OVERRIDE_HEADER = 'X-HTTP-Method-Override';

function createAbortError(): Error {
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  return error;
}

class LampaRequestInvocationError extends Error {}

type LampaRequestFn = (
  requestUrl: string,
  onSuccess: (responseBody: string | object) => void,
  onFailure: (lampaResponse: LampaFailureResponse) => void,
  requestPostData: string | false,
  requestParams: LampaAjaxParams
) => void;

export async function requestHttp(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse> {
  if (options.signal?.aborted) throw createAbortError();

  const method = options.method || 'GET';
  const headers = options.headers || {};
  const timeoutMs = options.timeoutMs || 15000;

  // Prefer Lampa.Reguest when running in Lampa environment
  if (typeof Lampa !== 'undefined' && Lampa.Reguest) {
    const lampaRequest = new Lampa.Reguest();
    lampaRequest.timeout(timeoutMs);

    const buildAjaxParams = (overrideMethod?: string): LampaAjaxParams => {
      const params: LampaAjaxParams = {
        crossDomain: true,
        dataType: 'text',
        headers: { ...headers },
        timeout: timeoutMs,
        type: overrideMethod || method,
      };
      if (overrideMethod) {
        params.headers[METHOD_OVERRIDE_HEADER] = method;
      }
      const contentType = headers['Content-Type'] || headers['content-type'];
      if (contentType) {
        params.contentType = contentType;
      }
      return params;
    };

    const dispatch = (
      invoke: LampaRequestFn,
      ajaxParams: LampaAjaxParams,
      postData: string | false
    ): Promise<HttpResponse> => new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(createAbortError());
        return;
      }

      let isSettled = false;

      const handleAbort = () => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutHandle);
        if (typeof lampaRequest.clear === 'function') lampaRequest.clear();
        reject(createAbortError());
      };

      const cleanup = () => {
        options.signal?.removeEventListener('abort', handleAbort);
      };

      // A hung native bridge call (no success or error callback ever fires)
      // must still resolve this promise within the caller's own deadline.
      const timeoutHandle = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(new Error(`Network error (${url}): request timed out`));
      }, timeoutMs);

      options.signal?.addEventListener('abort', handleAbort, { once: true });

      const settleResolve = (response: HttpResponse) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutHandle);
        cleanup();
        resolve(response);
      };

      const settleReject = (err: Error) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutHandle);
        cleanup();
        reject(err);
      };

      try {
        invoke(
          url,
          (responseBody: string | object) => {
            // Lampa's Reguest wrapper only passes the parsed body to its success callback
            // without exposing the underlying jqXHR status. We synthesize 200 vs 204 based
            // on whether the response body contains data.
            const hasBody = responseBody !== null && responseBody !== undefined && responseBody !== '';
            const responseText = typeof responseBody === 'string'
              ? responseBody
              : (responseBody ? JSON.stringify(responseBody) : '');
            const status = hasBody ? 200 : 204;
            const statusText = hasBody ? 'OK' : 'No Content';

            settleResolve({
              json: async () => (
                responseBody && typeof responseBody === 'object'
                  ? responseBody
                  : (responseText ? JSON.parse(responseText) : {})
              ),
              ok: true,
              status,
              statusText,
              text: async () => responseText,
            });
          },
          (lampaResponse: LampaFailureResponse) => {
            const status = lampaResponse?.status || 0;
            const statusText = lampaResponse?.statusText || lampaResponse?.message || '';
            const responseText = lampaResponse?.responseText || lampaResponse?.message || '';
            if (status >= 200 && status < 300) {
              settleResolve({
                json: async () => (responseText ? JSON.parse(responseText) : {}),
                ok: true,
                status,
                statusText,
                text: async () => responseText,
              });
            } else if (status > 0) {
              settleResolve({
                json: async () => (responseText ? JSON.parse(responseText) : {}),
                ok: false,
                status,
                statusText,
                text: async () => responseText,
              });
            } else {
              settleReject(new Error(`Network error (${url})`));
            }
          },
          postData,
          ajaxParams
        );
      } catch (error) {
        settleReject(new LampaRequestInvocationError(
          error instanceof Error ? error.message : String(error)
        ));
      }
    });

    const realPostData = options.body || (method === 'POST' ? '{}' : false);
    const isNativeBridgeUnsupportedMethod = method !== 'GET' && method !== 'POST' && method !== 'HEAD';

    if (typeof lampaRequest.native === 'function') {
      const nativeAjaxParams = isNativeBridgeUnsupportedMethod ? buildAjaxParams('POST') : buildAjaxParams();
      // Force a non-empty body so the bridge's GET-vs-POST body check picks POST,
      // otherwise a bodyless DELETE would silently become a GET on the wire.
      const nativePostData = isNativeBridgeUnsupportedMethod ? (options.body || '{}') : realPostData;

      try {
        return await dispatch(lampaRequest.native.bind(lampaRequest), nativeAjaxParams, nativePostData);
      } catch (err) {
        const isReadOnlyMethod = method === 'GET' || method === 'HEAD';
        // A caller that aborted mid-flight wants the request gone, not re-issued on the
        // fallback transport: re-dispatching would ignore the already-aborted signal and
        // deliver a response for a request nobody is waiting for any more.
        if (
          options.signal?.aborted
          || typeof lampaRequest.silent !== 'function'
          || (!(err instanceof LampaRequestInvocationError) && !isReadOnlyMethod)
        ) throw err;
        return await dispatch(lampaRequest.silent.bind(lampaRequest), buildAjaxParams(), realPostData);
      }
    }

    return dispatch(lampaRequest.silent.bind(lampaRequest), buildAjaxParams(), realPostData);
  }

  // Fallback to fetch (Node.js test environment or when Lampa.Reguest is unavailable)
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const handleAbort = () => controller?.abort();
  options.signal?.addEventListener('abort', handleAbort, { once: true });
  const timeoutHandle = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      body: options.body,
      headers: options.headers,
      method,
      signal: controller?.signal || options.signal,
    });
    const responseText = await response.text();
    return {
      json: async () => (responseText ? JSON.parse(responseText) : {}),
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: async () => responseText,
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    options.signal?.removeEventListener('abort', handleAbort);
  }
}
