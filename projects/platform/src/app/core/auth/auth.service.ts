import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { clearHttpCache } from '@marketspase/shared/core/http/http-cache.interceptor';
import { AuthUser, ErasureScheduleResponse, ApiEnvelope, MeResponse, SigninRequest, SigninResponse, SignupRequest, SignupResponse, UserRole } from './auth.models';

/** Canonical roles — absorbs legacy 'User'/'admin' casing; legacy G8 reads as Leader. */
export function normalizeRole(value: unknown): UserRole {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'g8') return 'leader';
  return v === 'admin' || v === 'leader' ? v : 'user';
}

/**
 * Session authority for the app. Primary transport is the backend's
 * httpOnly cookie — this service NEVER trusts `localStorage` for identity
 * (legacy stored `"[object Object]"` there and the old guard trusted it).
 *
 * Bearer fallback: cross-site third-party-cookie blocking can drop the
 * Set-Cookie while login succeeds — the signin body then carries the JWT
 * and we replay it as `Authorization: Bearer` (see authTokenInterceptor).
 * The cookie stays first-class whenever the browser keeps it; identity
 * itself always comes from `me()`, never from the stored token.
 *
 * State: `currentUser` signal (null = unknown/anonymous). `me()` hydrates
 * it server-side; the guard calls `resolve()` which uses the cache when warm.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);

  private static readonly TOKEN_KEY = 'dp_session_token';

  private readonly userSignal = signal<AuthUser | null>(null);
  private hydrated = false;

  /** Last-known user; null until `me()` succeeds. */
  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  /** Canonical role (backend may still serve legacy casing). */
  readonly role = computed(() => normalizeRole(this.userSignal()?.role));
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isLeader = computed(() => this.role() === 'leader' || this.role() === 'admin');
  readonly permissions = computed(() => this.userSignal()?.permissions ?? []);

  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  private track(user: AuthUser | null | undefined): void {
    if (user) {
      user = {
        ...user,
        role: normalizeRole(user.role),
        permissions: Array.isArray(user.permissions)
          ? [...new Set(user.permissions.map(String))]
          : [],
      };
    }
    this.userSignal.set(user ?? null);
    this.hydrated = true;
  }

  /**
   * Bearer fallback transport (see class docs). Persisted so a refresh
   * without the cookie still authenticates; cleared on sign-out and
   * whenever a signin response carries no token. Never used for identity.
   */
  private setToken(token: string | null | undefined): void {
    try {
      if (token) localStorage.setItem(AuthService.TOKEN_KEY, token);
      else localStorage.removeItem(AuthService.TOKEN_KEY);
    } catch { /* private mode: cookie path still applies */ }
  }

  /** Current fallback token for the interceptor (null = cookie-only). */
  token(): string | null {
    try {
      return localStorage.getItem(AuthService.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  signin(credentials: SigninRequest): Observable<SigninResponse> {
    return this.api.post<SigninResponse>('v1/auth/signin', credentials).pipe(
      tap((res) => {
        this.setToken(res.data?.token ?? null);
        this.track(res.data?.user);
      }),
    );
  }

  signup(payload: SignupRequest): Observable<SignupResponse> {
    return this.api.post<SignupResponse>('v1/auth/signup', payload);
  }

  verifyEmail(token: string): Observable<ApiEnvelope> {
    return this.api.post<ApiEnvelope>('v1/auth/verify-email', { token });
  }

  resendVerification(email: string): Observable<ApiEnvelope> {
    return this.api.post<ApiEnvelope>('v1/auth/resend-verification', { email });
  }

  /** Start the password reset flow (anti-enumeration: always succeeds server-side). */
  requestPasswordReset(email: string): Observable<ApiEnvelope> {
    return this.api.post<ApiEnvelope>('v1/auth/reset-password-request', { email });
  }

  /** Exchange the emailed token for a new password. */
  confirmResetPassword(payload: { token: string; newPassword: string }): Observable<ApiEnvelope> {
    return this.api.post<ApiEnvelope>('v1/auth/reset-password', payload);
  }

  signOut(): Observable<unknown> {
    return this.api.post('v1/auth/signout', {}).pipe(
      tap(() => {
        this.setToken(null);
        this.userSignal.set(null);
        this.hydrated = false;
        clearHttpCache();
      }),
    );
  }

  /** Server-verified session check (cookie → `GET /v1/auth/me`). */
  me(): Observable<MeResponse> {
    return this.api.get<MeResponse>('v1/auth/me').pipe(tap((res) => this.track(res.data)));
  }

  /**
   * Self-service erasure (GDPR): schedule your own deletion (30-day review)
   * or cancel a pending schedule. Callers refresh `me()` afterwards so the
   * `currentUser` signal carries the stamps.
   */
  requestErasure(): Observable<ErasureScheduleResponse> {
    return this.api.post<ErasureScheduleResponse>('v1/auth/me/erasure', {});
  }

  cancelErasure(): Observable<ApiEnvelope<{ cancelled: boolean }>> {
    return this.api.delete<ApiEnvelope<{ cancelled: boolean }>>('v1/auth/me/erasure');
  }

  /**
   * Presence heartbeat — stamps `lastSeenAt` so the admin directory can
   * show "Online now". Fire-and-forget: callers ignore errors (a missed
   * beat only delays the pill, never breaks the page).
   */
  ping(): Observable<unknown> {
    return this.api.post('v1/auth/ping', {});
  }

  /**
   * Guard entry: cached user → instant true; otherwise one `me()` call.
   * Resolves false (caller redirects) instead of throwing.
   */
  resolve(): Observable<boolean> {
    if (this.hydrated && this.userSignal() !== null) return of(true);
    return this.me().pipe(
      map(() => true),
      catchError(() => {
        this.setToken(null);
        this.userSignal.set(null);
        this.hydrated = false;
        return of(false);
      }),
    );
  }
}
