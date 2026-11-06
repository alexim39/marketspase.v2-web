import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../config/api-tokens';
import { cachedSingleton } from './cached-inject';

const getBase = cachedSingleton(() => inject(API_BASE_URL));
const getTokenKey = cachedSingleton(() => inject(AUTH_TOKEN_KEY));

/**
 * Bearer fallback for the API session. The httpOnly cookie remains primary;
 * this interceptor only replays the token stored by the app's auth service
 * when the browser dropped the cross-site cookie.
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('Authorization')) return next(req);
  const base = getBase() ?? '';
  const key = getTokenKey() ?? '';
  if (!key) return next(req);

  let token: string | null = null;
  try {
    token = localStorage.getItem(key);
  } catch {
    token = null;
  }

  const isApiRequest = base
    ? req.url.startsWith(base)
    : req.url.startsWith('/v1/') || req.url.startsWith('/uploads/');

  if (!token || !isApiRequest) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
