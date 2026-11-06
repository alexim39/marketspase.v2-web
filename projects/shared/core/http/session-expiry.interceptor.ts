import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MS_SESSION_LOGIN_PATH } from '../config/api-tokens';
import { SessionRecoveryService } from '../ui/session-recovery.service';
import { clearHttpCache } from './http-cache.interceptor';

let redirecting = false;

/**
 * A 401 means the secure session is gone. Preserve what the user typed,
 * tell them on the sign-in screen, and bring them back to the same page.
 * 403 is left to the page so it can explain a role requirement inline.
 */
export const sessionExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const loginPath = inject(MS_SESSION_LOGIN_PATH, { optional: true }) ?? '/partner/signin';
  const recovery = inject(SessionRecoveryService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const status = error instanceof HttpErrorResponse
        ? error.status
        : Number((error as { status?: unknown })?.status ?? -1);
      const url = req.url.toLowerCase();
      const onAuthCall = url.includes('/v1/auth/signin') || url.includes('/v1/auth/signup') || url.includes('/v1/auth/verify-email');
      const onSigninPage = typeof location !== 'undefined' && /signin|login/i.test(location.pathname);

      if (status === 401 && !onAuthCall && !onSigninPage) {
        recovery.captureCurrentWork('expired');
        clearHttpCache();
        try {
          sessionStorage.setItem('ms_session_notice_v1', 'expired');
        } catch { /* private mode */ }
        if (typeof window !== 'undefined') {
          const returnUrl = `${location.pathname}${location.search}`;
          const target = `${loginPath}?reason=expired&returnUrl=${encodeURIComponent(returnUrl)}`;
          if (!redirecting) {
            redirecting = true;
            window.setTimeout(() => window.location.assign(target), 60);
          }
        }
      }
      return throwError(() => error);
    }),
  );
};
