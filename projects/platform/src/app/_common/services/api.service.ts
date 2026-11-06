import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, Observable, retry, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  /** Base URL comes from the Angular environment (dev/prod swapped at build). */
  public readonly baseUrl = environment.apiUrl;

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Service: An error occurred:', error);
    return throwError(() => error);
  }

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, params?: HttpParams, headers?: HttpHeaders, withCredentials: boolean = false): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { params, headers, withCredentials }).pipe(
      retry({ count: 1, delay: 0 }),
      catchError(this.handleError)
    );
  }

  post<T>(endpoint: string, data: any, headers?: HttpHeaders, withCredentials: boolean = false): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, data, { headers, withCredentials }).pipe(
      retry({ count: 1, delay: 0 }),
      catchError(this.handleError)
    );
  }

  put<T>(endpoint: string, data: any, headers?: HttpHeaders, withCredentials: boolean = false): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, data, { headers, withCredentials }).pipe(
      retry({ count: 1, delay: 0 }),
      catchError(this.handleError)
    );
  }

  delete<T>(endpoint: string, params?: HttpParams, headers?: HttpHeaders, withCredentials: boolean = false): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, { params, headers, withCredentials }).pipe(
      retry({ count: 1, delay: 0 }),
      catchError(this.handleError)
    );
  }

  patch<T>(endpoint: string, data: any, headers?: HttpHeaders, withCredentials: boolean = false): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, data, { headers, withCredentials });
  }

  head<T>(endpoint: string, params?: HttpParams, headers?: HttpHeaders, withCredentials: boolean = false): Observable<T> {
    return this.http.head<T>(`${this.baseUrl}/${endpoint}`, { params, headers, withCredentials }).pipe(
      retry({ count: 1, delay: 0 }),
      catchError(this.handleError)
    );
  }
}