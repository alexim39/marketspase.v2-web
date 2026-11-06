import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Server-verified route guard. Replaces `dashboard/partner/guard.service.ts`,
 * which trusted a `localStorage` flag the backend never issued (and which
 * the signin page set to the string `"[object Object]"`).
 *
 * Cold navigation costs one `GET /v1/auth/me`; warm navigations resolve
 * synchronously from the cached `currentUser` signal.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.resolve().pipe(
    map((ok) => (ok ? true : router.createUrlTree(['/']))),
  );
};
