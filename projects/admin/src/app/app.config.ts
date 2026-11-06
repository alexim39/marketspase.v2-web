import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { environment } from '../environments/environment';
import { API_BASE_URL, AUTH_TOKEN_KEY } from './core/config/api-tokens';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/http/credentials.interceptor';
import { authTokenInterceptor } from './core/http/auth-token.interceptor';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';
import { adminSessionScopeInterceptor } from './core/http/admin-session-scope.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    { provide: API_BASE_URL, useFactory: () => environment.apiUrl.replace(/\/+$/, '') },
    { provide: AUTH_TOKEN_KEY, useValue: 'ms_admin_session_token' },
    provideHttpClient(
      withXhr(),
      withInterceptors([
        adminSessionScopeInterceptor,
        credentialsInterceptor,
        authTokenInterceptor,
        apiErrorInterceptor,
      ]),
    ),
  ],
};
