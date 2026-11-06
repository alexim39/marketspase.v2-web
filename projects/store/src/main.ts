import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { environment } from './environments/environment';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app/app-routing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withXhr } from '@angular/common/http';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideAnimations(),
    provideHttpClient(withXhr())
  ]
}).catch(err => console.error(err));
