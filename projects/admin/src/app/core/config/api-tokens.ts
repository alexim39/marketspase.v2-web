import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Canonical API base URL — normalized once (legacy `environment.apiUrl`
 * has a trailing slash in prod but not in dev, which produced `//` in
 * half the requests). New code injects this instead of reading
 * `environment` directly, so tests can override it.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl.replace(/\/+$/, ''),
});
