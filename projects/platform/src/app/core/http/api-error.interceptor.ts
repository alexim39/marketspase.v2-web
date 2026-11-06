import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { toApiError } from './api-error';

/**
 * Normalizes all HTTP failures to `ApiError` at the boundary.
 * Components handle ONE shape; nothing sensitive is logged or stored.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
