/**
 * Network Monitoring Module
 * Intercepts fetch and XMLHttpRequest to track network requests
 * Also injects traceparent headers for distributed tracing
 */
import { sendEvent } from '../transport';
import { getConfig } from '../config';
import { getTraceHeaders } from './trace';

let originalFetch: typeof fetch | null = null;
let originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
let originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
let originalXHRSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null = null;

interface NetworkRequestData {
  method: string;
  url: string;
  startTime: number;
  requestHeaders?: Record<string, string>;
}

const pendingXHRs = new WeakMap<XMLHttpRequest, NetworkRequestData>();

function shouldIgnoreUrl(url: string): boolean {
  const config = getConfig();
  const ignorePatterns = config.ignoreUrls || [];

  // Always ignore requests to our own endpoints
  if (config.endpoint && url.includes(config.endpoint)) {
    return true;
  }

  // Check all product endpoints
  if (config.endpoints) {
    const endpoints = Object.values(config.endpoints).filter(Boolean) as string[];
    for (const endpoint of endpoints) {
      if (url.includes(endpoint)) {
        return true;
      }
    }
  }

  return ignorePatterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  });
}

function parseUrl(url: string): { path: string; host: string } {
  try {
    const parsed = new URL(url, window.location.origin);
    return {
      path: parsed.pathname + parsed.search,
      host: parsed.host,
    };
  } catch {
    return { path: url, host: '' };
  }
}

function getResponseSize(response: Response): number | undefined {
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    return parseInt(contentLength, 10);
  }
  return undefined;
}

/**
 * Wrap fetch to track network requests and inject traceparent headers
 */
function wrapFetch(): void {
  originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';

    // Inject traceparent header for distributed tracing (for non-ignored URLs)
    const traceHeaders = getTraceHeaders();
    if (Object.keys(traceHeaders).length > 0 && !shouldIgnoreUrl(url)) {
      const existingHeaders = init?.headers || {};
      const headers = new Headers(existingHeaders as HeadersInit);

      // Only add traceparent if not already present
      if (!headers.has('traceparent') && traceHeaders.traceparent) {
        headers.set('traceparent', traceHeaders.traceparent);
      }

      init = { ...init, headers };
    }

    if (shouldIgnoreUrl(url)) {
      return originalFetch!.call(window, input, init);
    }

    const startTime = performance.now();
    const { path, host } = parseUrl(url);

    try {
      const response = await originalFetch!.call(window, input, init);
      const duration = performance.now() - startTime;

      sendEvent('network', {
        type: 'fetch',
        method: method.toUpperCase(),
        url,
        path,
        host,
        status: response.status,
        statusText: response.statusText,
        duration_ms: Math.round(duration),
        size: getResponseSize(response),
        success: response.ok,
      });

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;

      sendEvent('network', {
        type: 'fetch',
        method: method.toUpperCase(),
        url,
        path,
        host,
        status: 0,
        duration_ms: Math.round(duration),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  };
}

/**
 * Wrap XMLHttpRequest to track network requests
 */
function wrapXHR(): void {
  originalXHROpen = XMLHttpRequest.prototype.open;
  originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ): void {
    const urlString = url instanceof URL ? url.href : url;

    pendingXHRs.set(this, {
      method: method.toUpperCase(),
      url: urlString,
      startTime: 0,
    });

    return originalXHROpen!.call(this, method, url, async, username, password);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    const xhr = this;
    const requestData = pendingXHRs.get(xhr);

    // Inject traceparent header for distributed tracing
    if (requestData && !shouldIgnoreUrl(requestData.url)) {
      const traceHeaders = getTraceHeaders();
      if (traceHeaders.traceparent) {
        try {
          xhr.setRequestHeader('traceparent', traceHeaders.traceparent);
        } catch {
          // Header may have already been set, ignore
        }
      }
    }

    if (!requestData || shouldIgnoreUrl(requestData.url)) {
      return originalXHRSend!.call(this, body);
    }

    requestData.startTime = performance.now();
    const { path, host } = parseUrl(requestData.url);

    const handleLoadEnd = (): void => {
      const duration = performance.now() - requestData.startTime;

      sendEvent('network', {
        type: 'xhr',
        method: requestData.method,
        url: requestData.url,
        path,
        host,
        status: xhr.status,
        statusText: xhr.statusText,
        duration_ms: Math.round(duration),
        success: xhr.status >= 200 && xhr.status < 400,
      });

      pendingXHRs.delete(xhr);
    };

    const handleError = (): void => {
      const duration = performance.now() - requestData.startTime;

      sendEvent('network', {
        type: 'xhr',
        method: requestData.method,
        url: requestData.url,
        path,
        host,
        status: 0,
        duration_ms: Math.round(duration),
        success: false,
        error: 'Network error',
      });

      pendingXHRs.delete(xhr);
    };

    xhr.addEventListener('loadend', handleLoadEnd, { once: true });
    xhr.addEventListener('error', handleError, { once: true });

    return originalXHRSend!.call(this, body);
  };
}

export function setupNetworkTracking(): void {
  wrapFetch();
  wrapXHR();

  const config = getConfig();
  if (config.debug) {
    console.log('[BrainzLab] Network tracking enabled');
  }
}

export function teardownNetworkTracking(): void {
  // Restore original fetch
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }

  // Restore original XHR methods
  if (originalXHROpen) {
    XMLHttpRequest.prototype.open = originalXHROpen;
    originalXHROpen = null;
  }

  if (originalXHRSend) {
    XMLHttpRequest.prototype.send = originalXHRSend;
    originalXHRSend = null;
  }
}
