import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, of, tap, throwError } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { NetworkStatusService } from '../ui/network-status.service';

const CACHE_PREFIX = 'ms_http_cache_v1:';
const MAX_ENTRY_CHARS = 320_000;
const MAX_ENTRIES = 45;

/** Identical reads already on the wire — shared so one response serves all. */
const IN_FLIGHT = new Map<string, Observable<HttpEvent<unknown>>>();

/** Reads that must never be served from a stale copy. */
const NEVER_CACHE = /\/v1\/auth|paystack|\/verify|\/refund|\/deposit|\/withdraw|\/send|\/sms|\/email/i;

interface CacheEntry {
  at: number;
  body: unknown;
}

/**
 * Keeps the last successful GET response in sessionStorage and serves it only
 * when the network cannot reach the API. Mutations, payments and identity are
 * never cached. This lets pages stay on screen offline instead of blanking.
 */
export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const isIdentityRead = /\/v1\/auth\/me(?:\?|$)/.test(req.url);
  if (req.method !== 'GET' || !/\/v1\//.test(req.url) || (!isIdentityRead && NEVER_CACHE.test(req.url))) {
    return next(req);
  }

  const network = inject(NetworkStatusService);
  const key = cacheKey(req.urlWithParams);
  const cached = read(key);

  if (typeof navigator !== 'undefined' && !navigator.onLine && cached) {
    network.noteCacheHit();
    return of(new HttpResponse({ status: 200, statusText: 'OK (cached)', body: cached.body }));
  }

  // Dashboard-style pages often request the same read from two components.
  // Share the in-flight GET so both get one network response; the entry is
  // removed as soon as the source completes or errors.
  const inFlightKey = `${req.method} ${req.urlWithParams}`;
  const pending = IN_FLIGHT.get(inFlightKey);
  if (pending) return pending;

  const request$ = next(req).pipe(
    tap((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse) write(key, event.body);
    }),
    catchError((error: unknown) => {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      if ((status === 0 || status >= 500) && cached) {
        network.noteCacheHit();
        return of(new HttpResponse({ status: 200, statusText: 'OK (cached)', body: cached.body }));
      }
      return throwError(() => error);
    }),
    finalize(() => IN_FLIGHT.delete(inFlightKey)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  IN_FLIGHT.set(inFlightKey, request$);
  return request$;
};

export function clearHttpCache(): void {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Cache is best-effort.
  }
}

function cacheKey(url: string): string {
  const scope = typeof location !== 'undefined' ? location.origin : 'ms';
  return `${CACHE_PREFIX}${scope}:${url}`;
}

function read(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    return entry && typeof entry.at === 'number' ? entry : null;
  } catch {
    return null;
  }
}

function write(key: string, body: unknown): void {
  try {
    const raw = JSON.stringify({ at: Date.now(), body });
    if (raw.length > MAX_ENTRY_CHARS) return;
    evictIfNeeded();
    sessionStorage.setItem(key, raw);
  } catch {
    // Quota/private mode: the live request still succeeded.
  }
}

function evictIfNeeded(): void {
  try {
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length < MAX_ENTRIES) return;
    keys
      .sort((a, b) => {
        const aAt = read(a)?.at ?? 0;
        const bAt = read(b)?.at ?? 0;
        return aAt - bAt;
      })
      .slice(0, Math.max(1, keys.length - MAX_ENTRIES + 1))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Ignore: cache is best-effort.
  }
}
