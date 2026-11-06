import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { environment } from './environments/environment';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app/app-routing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { API_BASE_URL } from '@marketspase/shared/core/config/api-tokens';
import { apiErrorInterceptor } from '@marketspase/shared/core/http/api-error.interceptor';
import { credentialsInterceptor } from '@marketspase/shared/core/http/credentials.interceptor';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideAnimations(),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { floatLabel: 'always' } },
    { provide: API_BASE_URL, useFactory: () => environment.apiUrl.replace(/\/+$/, '') },
    provideHttpClient(withXhr(), withInterceptors([credentialsInterceptor, apiErrorInterceptor])),
  ]
}).catch(err => console.error(err));
