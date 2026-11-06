import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../config/api-tokens';
import { cachedSingleton } from './cached-inject';

const getBase = cachedSingleton(() => inject(API_BASE_URL));

/**
 * Marks admin-originated API requests so the backend selects the `admin_jwt`
 * cookie. The partner platform keeps using `jwt`; signing into one app no
 * longer replaces the other session in the same browser.
 */
export const adminSessionScopeInterceptor: HttpInterceptorFn = (req, next) => {
  const base = getBase() ?? '';
  const isApiRequest = base
    ? req.url.startsWith(base)
    : req.url.startsWith('/v1/') || req.url.startsWith('/uploads/');
  if (!isApiRequest) return next(req);
  return next(req.clone({ setHeaders: { 'X-Client': 'admin' } }));
};
