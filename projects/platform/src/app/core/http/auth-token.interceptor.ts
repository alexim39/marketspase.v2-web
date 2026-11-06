import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../config/api-tokens';
import { AuthService } from '../auth/auth.service';
import { cachedSingleton } from './cached-inject';

const getBase = cachedSingleton(() => inject(API_BASE_URL));
const getAuth = cachedSingleton(() => inject(AuthService));

/**
 * Bearer fallback for the backend JWT session. Runs beside
 * `credentialsInterceptor` (cookie stays primary): when the browser
 * dropped the cross-site `jwt` cookie, replay the token the signin
 * response carried in its body. Scoped to API-host requests only —
 * never leaks onto third-party calls.
 *
 * Interceptors fire per request — including from click handlers and timers
 * with no injection context — so dependencies resolve through capture-once
 * singletons instead of bare `inject()` (NG0203). Never throws, never
 * blocks the request.
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('Authorization')) return next(req);
  const base = getBase() ?? '';
  const token = getAuth()?.token() ?? null;
  if (!token || !base || !req.url.startsWith(base)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
