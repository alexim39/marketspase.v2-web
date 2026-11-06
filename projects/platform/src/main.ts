import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

// Offline shell + push share one worker (push-sw.js). Production only:
// the worker's stale-while-revalidate cache assumes hashed filenames —
// dev builds reuse chunk URLs across edits, so a dev-registered worker
// serves stale chunks mixed with fresh code (split-brain module identities
// surfacing as NG02xx injection errors). Registering at boot (idempotent —
// the push flow reuses the same registration) so the app shell is cached
// and installable even before push is ever enabled.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (environment.production) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/push-sw.js').catch(() => null);
    });
  } else {
    // Self-heal dev browsers poisoned by an earlier registration: drop the
    // worker and its shell cache so no stale chunk can outlive this boot.
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister().catch(() => null)))
      .catch(() => null);
    if ('caches' in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k).catch(() => null))))
        .catch(() => null);
    }
  }
}
