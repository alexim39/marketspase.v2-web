import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/http/credentials.interceptor';
import { authTokenInterceptor } from './core/http/auth-token.interceptor';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    provideHttpClient(
      withXhr(),
      withInterceptors([credentialsInterceptor, authTokenInterceptor, apiErrorInterceptor]),
    ),
  ],
};
