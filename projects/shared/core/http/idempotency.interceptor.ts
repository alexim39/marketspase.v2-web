import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

const MONEY_PATHS = [
  /\/v1\/billing\/withdrawals$/,
  /\/v1\/billing\/deposit\/(?:paystack\/)?init$/,
  /\/v1\/stores\/[^/]+\/orders$/,
  /\/v1\/campaigns$/,
  /\/v1\/prospects\/claim$/,
  /\/v1\/outreach\/(?:sms|email)$/,
  /\/v1\/onboarding\/orders$/,
];

const newKey = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `ms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

/**
 * Stable idempotency keys for money-changing requests, plus one safe retry
 * on a transport failure (status 0). The same key is reused for the retry so
 * the server can return the original result instead of moving money twice.
 */
export const idempotencyInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next(req);
  if (!MONEY_PATHS.some((pattern) => pattern.test(req.url))) return next(req);

  const withKey = req.headers.has('Idempotency-Key')
    ? req
    : req.clone({ setHeaders: { 'Idempotency-Key': newKey() } });

  return next(withKey).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 0) {
        return next(withKey);
      }
      return throwError(() => error);
    }),
  );
};
