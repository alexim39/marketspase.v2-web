import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { NetworkStatusService } from '../ui/network-status.service';
import { SILENT_LOADING_HEADER } from './silent-loading';

/**
 * Feeds real request activity and duration into the shared connection banner.
 * Background work stays out of the slow-connection signal — a delayed poll
 * should never interrupt the page with a notice.
 */
export const networkStatusInterceptor: HttpInterceptorFn = (req, next) => {
  const network = inject(NetworkStatusService);
  const tracked = /\/v1\//.test(req.url) && !req.headers.has(SILENT_LOADING_HEADER);
  if (!tracked) return next(req);
  network.startRequest();
  return next(req).pipe(finalize(() => network.endRequest()));
};
