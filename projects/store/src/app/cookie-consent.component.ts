import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { ConsentService } from './_common/services/consent.service';

@Component({
  selector: 'async-cookie-consent',
  imports: [MatButtonModule, RouterModule],
  template: `
    @if (consent.bannerVisible()) {
      <aside class="cookie-banner" role="region" aria-label="Cookie consent">
        <p>
          We use cookies to measure site performance and improve your experience.
          Read our <a routerLink="/legal/cookies">Cookie Policy</a>.
        </p>
        <div class="cookie-actions">
          <button mat-flat-button type="button" (click)="consent.accept()">Accept</button>
          <button mat-stroked-button type="button" (click)="consent.decline()">Decline</button>
        </div>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .cookie-banner {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1200;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.25em;
      flex-wrap: wrap;
      padding: 1em 1.25em;
      background: rgba(3, 1, 15, 0.98);
      color: #fff;
      border-top: 2px solid var(--dp-gold);
      box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
    }
    .cookie-banner p {
      margin: 0;
      max-width: 680px;
      font-size: 0.92rem;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.85);
    }
    .cookie-banner a {
      color: var(--dp-gold-bright);
      font-weight: 700;
    }
    .cookie-actions {
      display: flex;
      gap: 0.75em;
      flex-wrap: wrap;
    }
    .cookie-actions button {
      min-height: 44px;
    }
    .cookie-actions button:first-child {
      background: var(--dp-gold-bright);
      color: #111;
    }
    .cookie-actions button:last-child {
      border-color: var(--dp-gold);
      color: var(--dp-gold-bright);
    }
    @media (max-width: 600px) {
      .cookie-banner {
        align-items: flex-start;
        padding: 1em;
      }
      .cookie-actions {
        width: 100%;
      }
    }
  `]
})
export class CookieConsentComponent {
  constructor(public consent: ConsentService) {}
}
