import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { isQueueableWrite, OUTBOX_BYPASS, OutboxService } from './outbox.service';
import { cachedSingleton } from '../http/cached-inject';

const getOutbox = cachedSingleton(() => inject(OutboxService));

/**
 * Queues failed mutating calls while offline. Only network failures
 * (status 0) on allowlisted endpoints — server 4xx/5xx always surface.
 * Replay traffic carries the bypass header so it can never re-queue.
 *
 * Resolves through a capture-once singleton so context-less requests
 * (clicks, timers) degrade to pass-through instead of throwing NG0203.
 */
export const offlineQueueInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(OUTBOX_BYPASS)) return next(req);
  const outbox = getOutbox();
  if (!outbox) return next(req);
  return next(req).pipe(
    catchError((error: unknown) => {
      const status = error instanceof HttpErrorResponse ? error.status : -1;
      if (status === 0 && isQueueableWrite(req.method, req.url)) {
        outbox.enqueue({ method: req.method, url: req.url, body: req.body ?? null });
      }
      return throwError(() => error);
    }),
  );
};
