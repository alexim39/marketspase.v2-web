import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { NetworkStatusService } from '../ui/network-status.service';

/** Feeds real request activity and duration into the shared connection banner. */
export const networkStatusInterceptor: HttpInterceptorFn = (req, next) => {
  const network = inject(NetworkStatusService);
  const tracked = /\/v1\//.test(req.url);
  if (!tracked) return next(req);
  network.startRequest();
  return next(req).pipe(finalize(() => network.endRequest()));
};
