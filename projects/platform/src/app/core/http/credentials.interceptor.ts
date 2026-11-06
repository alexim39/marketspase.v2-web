import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Cookie transport for the backend's httpOnly JWT session.
 * The API authenticates via `Set-Cookie: jwt=...` (see backend
 * `identity-access` slice) — every request must carry credentials.
 * Global here so legacy `ApiService` calls (default `withCredentials:false`)
 * are fixed without touching 100+ call sites.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.withCredentials) return next(req);
  return next(req.clone({ withCredentials: true }));
};
