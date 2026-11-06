import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';
import { ConnectionBannerComponent } from '@marketspase/shared/ui/connection-banner/connection-banner.component';
import { FooterComponent } from './footer/footer.component';
import { CookieConsentComponent } from './cookie-consent.component';
import { SiteHeaderComponent } from './_common/components/site-header.component';

@Component({
    selector: 'async-root',
    imports: [RouterModule, FooterComponent, CookieConsentComponent, SiteHeaderComponent, ConnectionBannerComponent],
    template: `
    <div id="container">
      <async-connection-banner />
      <a class="skip-link" href="#main">Skip to content</a>
      <async-site-header />
      <main id="main">
        <router-outlet id="outlet" />
      </main>
      <async-footer id="footer" />
      <async-cookie-consent />
    </div>
  `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
    #container {
      animation: fadeInAnimation ease 0.3s;
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    main { flex: 1; }

    @keyframes fadeInAnimation {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }

    .skip-link {
      position: absolute;
      left: -9999px;
      top: 0;
      background: var(--ms-primary-strong);
      color: #fff;
      padding: 0.75em 1.25em;
      font-weight: 700;
      z-index: 2000;
      text-decoration: none;
    }
    .skip-link:focus { left: 0; }

    @media (prefers-reduced-motion: reduce) {
      #container { animation: none; }
    }
  `]
})
export class AppComponent implements OnInit {
  private readonly themes = inject(ThemeService);

  ngOnInit(): void {
    this.themes.init();
  }
}
