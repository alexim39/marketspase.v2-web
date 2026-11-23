import { Component, ChangeDetectionStrategy, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeTogglerService } from './_common/services/theme-toggler.service';
import { OfflineBannerComponent } from './core/offline/offline-banner.component';
import { ConnectionBannerComponent } from '@marketspase/shared/ui/connection-banner/connection-banner.component';
import { SessionRecoveryService } from '@marketspase/shared/core/ui/session-recovery.service';
import { SeoService } from './core/seo/seo.service';



@Component({
selector: 'async-root',
imports: [RouterOutlet, OfflineBannerComponent, ConnectionBannerComponent],
template: `
  <div id="container">
    <div class="body">
      <async-connection-banner placement="top" />
      <async-offline-banner/>
      <router-outlet/>
    </div>
  </div>
  `,
changeDetection: ChangeDetectionStrategy.Eager,
styles: [`

#container {
  .body {
    display: grid;
    min-height: 100vh;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
  }
}

/* Extra small devices (phones, 600px and down) */
@media only screen and (max-width: 600px) {
  #container {
    display:flex;
    flex-direction: column;
  }
}
  
`]
})
export class AppComponent implements OnInit {
  private readonly themes = inject(ThemeTogglerService);
  private readonly recovery = inject(SessionRecoveryService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.themes.init();
    this.recovery.restorePending();
    this.seo.apply(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.seo.apply(event.urlAfterRedirects));
  }
}
