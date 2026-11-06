import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-tokens';

/**
 * Typed HTTP client for NEW code (strangler beside legacy `ApiService`).
 * - Base URL injected (test-overridable, slash-safe join).
 * - `withCredentials: true` always — backend session is an httpOnly cookie.
 * - RxJS stays for async streams; components bridge to view state with
 *   `toSignal` / `takeUntilDestroyed`, never bare `.subscribe()`.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private url(endpoint: string): string {
    return `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
  }

  get<T>(endpoint: string, params?: HttpParams, headers?: HttpHeaders): Observable<T> {
    return this.http.get<T>(this.url(endpoint), { params, headers, withCredentials: true });
  }

  post<T>(endpoint: string, body: unknown, headers?: HttpHeaders): Observable<T> {
    return this.http.post<T>(this.url(endpoint), body, { headers, withCredentials: true });
  }

  put<T>(endpoint: string, body: unknown, headers?: HttpHeaders): Observable<T> {
    return this.http.put<T>(this.url(endpoint), body, { headers, withCredentials: true });
  }

  patch<T>(endpoint: string, body: unknown, headers?: HttpHeaders): Observable<T> {
    return this.http.patch<T>(this.url(endpoint), body, { headers, withCredentials: true });
  }

  delete<T>(endpoint: string, params?: HttpParams, headers?: HttpHeaders): Observable<T> {
    return this.http.delete<T>(this.url(endpoint), { params, headers, withCredentials: true });
  }

  /** File downloads (CSV exports) — cookie session preserved, binary body. */
  download(endpoint: string): Observable<Blob> {
    return this.http.get(this.url(endpoint), { withCredentials: true, responseType: 'blob' });
  }

  /** Multipart uploads — cookie session preserved, browser sets the boundary. */
  upload<T>(endpoint: string, form: FormData): Observable<T> {
    return this.http.post<T>(this.url(endpoint), form, { withCredentials: true });
  }
}
