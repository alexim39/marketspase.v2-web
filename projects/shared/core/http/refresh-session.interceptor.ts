import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../config/api-tokens';
import { cachedSingleton } from './cached-inject';

const getBase = cachedSingleton(() => inject(API_BASE_URL));
const getTokenKey = cachedSingleton(() => inject(AUTH_TOKEN_KEY));

let refreshInFlight: Promise<string | null> | null = null;

const isAuthEndpoint = (url: string) =>
  /\/v1\/auth\/(signin|signup|verify-email|resend-verification|reset-password|reset-password-request|refresh)$/.test(url);

const storeToken = (key: string, token: string | null) => {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch { /* cookie path still applies */ }
};

const refreshAccessToken = async (base: string, key: string): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const baseUrl = String(base ?? '').replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(key.toLowerCase().includes('admin') ? { 'X-Client': 'admin' } : {}),
          },
          body: '{}',
        });
        if (!response.ok) return null;
        const body = await response.json().catch(() => null);
        const token = body?.data?.token ?? null;
        storeToken(key, token);
        return token;
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
 * interceptor redirects. The refresh token itself is httpOnly; this code
 * never sees it. Concurrent 401s share one refresh promise.
 */
export const refreshSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const base = getBase() ?? '';
  const key = getTokenKey() ?? '';
  const isApiRequest = base
    ? req.url.startsWith(base)
    : req.url.startsWith('/v1/');
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
