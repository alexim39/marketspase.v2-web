import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../config/api-tokens';
import { cachedSingleton } from './cached-inject';

const getBase = cachedSingleton(() => inject(API_BASE_URL));
const getTokenKey = cachedSingleton(() => inject(AUTH_TOKEN_KEY));

let refreshInFlight: Promise<string | null> | null = null;

/** The body-token fallback lives beside the access token: `<key>_refresh`. */
const refreshKeyFor = (key: string) => `${key}_refresh`;

const isAuthEndpoint = (url: string) =>
  /\/v1\/auth\/(signin|signup|verify-email|resend-verification|reset-password|reset-password-request|refresh)$/.test(url);

const readToken = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const storeToken = (key: string, token: string | null) => {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch { /* cookie path still applies */ }
};

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Another tab may be rotating the single-use refresh token right now. Give
 * it a moment to publish the replacement before replaying the old one.
 */
const waitForReplacement = async (key: string, previous: string | null): Promise<string | null> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = readToken(key);
    if (current && current !== previous) return current;
    await pause(100);
  }
  return readToken(key);
};

const requestRefreshToken = async (base: string, key: string, refreshToken: string | null) => {
  const baseUrl = String(base ?? '').replace(/\/+$/, '');
  return fetch(`${baseUrl}/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(key.toLowerCase().includes('admin') ? { 'X-Client': 'admin' } : {}),
    },
    // The cookie is sent automatically. The server prefers the explicit body
    // token (a blocked Set-Cookie can leave the cookie stale) and falls back
    // to the cookie when no body token is available.
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });
};

const runRefresh = async (base: string, key: string, observed: string | null): Promise<string | null> => {
  const refreshKey = refreshKeyFor(key);
  const currentRefresh = readToken(refreshKey);

  // Another tab finished rotating while this one waited for the cross-tab
  // lock: reuse the access token it just published instead of rotating again.
  if (currentRefresh && currentRefresh !== observed) {
    const latestAccess = readToken(key);
    if (latestAccess) return latestAccess;
  }

  let response = await requestRefreshToken(base, key, currentRefresh);

  if ((response.status === 401 || response.status === 403) && currentRefresh) {
    const replacement = await waitForReplacement(refreshKey, currentRefresh);
    if (replacement && replacement !== currentRefresh) {
      response = await requestRefreshToken(base, key, replacement);
    }
  }

  if (response.status === 401 || response.status === 403) {
    // The rotating session is gone (or was reused by someone else). Clear
    // both fallbacks so the next guard check redirects once, not in a loop.
    storeToken(key, null);
    storeToken(refreshKey, null);
    return null;
  }
  if (!response.ok) {
    // Transient (5xx/429/offline): keep the tokens and let the next call retry.
    return null;
  }

  const body = await response.json().catch(() => null);
  const token = body?.data?.token ?? null;
  if (!token) return null;

  storeToken(key, token);
  const rotated = body?.data?.refreshToken ?? null;
  if (rotated) storeToken(refreshKey, rotated);
  return token;
};

type WebLocks = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

const webLocks = (): WebLocks | undefined =>
  (globalThis as { navigator?: { locks?: WebLocks } }).navigator?.locks;

const refreshAccessToken = async (base: string, key: string): Promise<string | null> => {
  if (!refreshInFlight) {
    // Captured before waiting for the lock so a cross-tab race is visible.
    const observed = readToken(refreshKeyFor(key));
    refreshInFlight = (async () => {
      try {
        // Serialize rotation across tabs where the Web Locks API is
        // available; the token-changed check above covers older browsers.
        const locks = webLocks();
        if (locks) {
          return await locks.request(
            `marketspase-auth-refresh:${key}`,
            () => runRefresh(base, key, observed),
          );
        }
        return await runRefresh(base, key, observed);
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
};

/**
 * Silent refresh for expired 15-minute access tokens.
 *
 * Runs closest to the network so it can retry before the session-expiry
 * interceptor redirects. The httpOnly cookie is preferred; when the browser
 * drops it as a third-party cookie, the rotating token issued at signin is
 * replayed in the request body instead. Concurrent 401s share one refresh
 * promise, and rotation is serialized across tabs.
 */
export const refreshSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const base = getBase() ?? '';
  const key = getTokenKey() ?? '';
  const isApiRequest = base
    ? req.url.startsWith(base)
    : !/^https?:\/\//i.test(req.url);
  if (!isApiRequest || !key || isAuthEndpoint(req.url)) return next(req);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return from(refreshAccessToken(base, key)).pipe(
        switchMap((token) => {
          if (!token) return throwError(() => error);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
        }),
      );
    }),
  );
};
