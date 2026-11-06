import { InjectionToken } from '@angular/core';

/**
 * Canonical API base URL. Apps provide their own value from their environment
 * so development proxies and production hosts stay explicit and overridable.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

/**
 * Session token storage key used by the shared bearer fallback interceptor.
 * Each app provides its own key; the token is never hardcoded in the client.
 */
export const AUTH_TOKEN_KEY = new InjectionToken<string>('AUTH_TOKEN_KEY', {
  providedIn: 'root',
  factory: () => 'ms_session_token',
});

/** Route used when an authenticated session expires. */
export const MS_SESSION_LOGIN_PATH = new InjectionToken<string>('MS_SESSION_LOGIN_PATH', {
  providedIn: 'root',
  factory: () => '/partner/signin',
});
