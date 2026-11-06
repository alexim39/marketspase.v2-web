import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { UserRole } from './auth.models';

/**
 * Role gate factory for the standalone admin app. Anonymous visitors go to
 * the admin sign-in page; signed-in non-admins are sent back there with a
 * reason so the page can explain the refusal without exposing the console.
 */
export function requireRoleGuard(...roles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.resolve().pipe(
      switchMap((ok) => {
        if (!ok) return of(router.createUrlTree(['/signin']));
        return of(
          roles.includes(auth.role())
            ? true
            : router.createUrlTree(['/signin'], { queryParams: { reason: 'forbidden' } }),
        );
      }),
    );
  };
}

/** Shorthand for the admin console. */
export const adminGuard: CanActivateFn = requireRoleGuard('admin');

/** Explicit capability gate; admin role does not imply this permission. */
export function requirePermissionGuard(permission: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.resolve().pipe(
      switchMap((ok) => {
        if (!ok) return of(router.createUrlTree(['/signin']));
        return of(
          auth.hasPermission(permission)
            ? true
            : router.createUrlTree(['/'], { queryParams: { reason: 'forbidden' } }),
        );
      }),
    );
  };
}

