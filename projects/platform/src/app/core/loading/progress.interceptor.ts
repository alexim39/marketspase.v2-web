import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { TopProgressService } from './top-progress.service';
import { cachedSingleton } from '../http/cached-inject';

const getProgress = cachedSingleton(() => inject(TopProgressService));

/**
 * Drives the top progress bar for foreground requests. Background work
 * (polling, prefetch) opts out with the `X-Silent-Loading` header, which
 * is stripped here so it never reaches the server.
 *
 * Resolves through a capture-once singleton: requests fired outside any
 * injection context (clicks, timers) must not throw NG0203 — worst case
 * the bar skips one request.
 */
export const SILENT_LOADING_HEADER = 'X-Silent-Loading';

export const progressInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(SILENT_LOADING_HEADER)) {
    return next(req.clone({ headers: req.headers.delete(SILENT_LOADING_HEADER) }));
  }
  const progress = getProgress();
  if (!progress) return next(req);
  progress.show();
  return next(req).pipe(finalize(() => progress.hide()));
};
