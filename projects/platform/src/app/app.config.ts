import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { API_BASE_URL, AUTH_TOKEN_KEY } from './core/config/api-tokens';
import { MS_SESSION_LOGIN_PATH } from '@marketspase/shared/core/config/api-tokens';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { progressInterceptor } from './core/loading/progress.interceptor';
import { offlineQueueInterceptor } from './core/offline/offline-queue.interceptor';
import { credentialsInterceptor } from './core/http/credentials.interceptor';
import { authTokenInterceptor } from './core/http/auth-token.interceptor';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';
import { httpCacheInterceptor } from '@marketspase/shared/core/http/http-cache.interceptor';
import { networkStatusInterceptor } from '@marketspase/shared/core/http/network-status.interceptor';
import { sessionExpiryInterceptor } from '@marketspase/shared/core/http/session-expiry.interceptor';
import { provideEchartsCore } from 'ngx-echarts';
import { echarts } from './core/charts/echarts-setup';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideAnimationsAsync(),
    // Single DateAdapter for every date/time picker (pages no longer each provide their own).
    provideNativeDateAdapter(),
    // Labels stay visible on the outline whether a field is empty, focused or
    // prefilled, so programmatic values (ngModel/FormControl) never overlap.
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { floatLabel: 'always' } },
    { provide: API_BASE_URL, useFactory: () => environment.apiUrl.replace(/\/+$/, '') },
    { provide: AUTH_TOKEN_KEY, useValue: 'dp_session_token' },
    { provide: MS_SESSION_LOGIN_PATH, useValue: '/partner/signin' },
    // Single HttpClient: cookie transport + bearer fallback + cached reads +
    // real request progress + normalized errors + session recovery.
    provideHttpClient(withXhr(), withInterceptors([
      credentialsInterceptor,
      authTokenInterceptor,
      httpCacheInterceptor,
      networkStatusInterceptor,
      progressInterceptor,
      apiErrorInterceptor,
      offlineQueueInterceptor,
      sessionExpiryInterceptor,
    ])),
    // ECharts core once (treeshaken); chart components use NgxEchartsDirective.
    provideEchartsCore({ echarts }),
  ]
};
