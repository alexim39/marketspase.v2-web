import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'async-logo',
    imports: [MatIconModule, RouterModule],
    template: `
    <a
      [routerLink]="link"
      [style.color]="color"
      [class.on-light]="theme === 'light' && !compact"
      [class.compact]="compact"
      aria-label="MarketSpase home"
    >
      @if (compact) {
        <span class="brand-mark" aria-hidden="true">M</span>
      } @else {
        <picture>
          <source media="(max-width: 600px)" srcset="/logo/marketspase-mark-white.png">
          <img src="/logo/marketspase-logo-white.png" alt="MarketSpase">
        </picture>
      }
    </a>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
    a {
      text-decoration: none;
      display: flex;
      align-items: center;
      margin-left: 3em;
      img {
        display: block;
        height: 2.5em;
        width: auto;
        max-width: 10em;
        object-fit: contain;
      }
    }

    /* The supplied wordmark is white. On a light rail, render a dark copy
       without needing a second brand asset. */
    a.on-light img {
      filter: brightness(0);
    }

    /* Collapsed rail mark: a compact branded M instead of the clipped wordmark. */
    a.compact {
      margin-left: 0;
      justify-content: center;
      width: 100%;
    }

    .brand-mark {
      display: inline-grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      font-size: 1.05rem;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.04em;
      box-shadow: 0 6px 18px rgba(102, 126, 234, 0.4);
    }

/* Media Query for Mobile Responsiveness */
@media screen and (max-width: 600px) {
  a {
    margin-left: 0;
    img {
        height: 2em;
        max-width: 8em;
      }
  }
}
  `]
})
export class LogoComponent {
  
  @Input() color = '#14122b';
  /** Where the logo points. The authenticated shell sends users to /dashboard. */
  @Input() link = '/';
  /** `light` inverts the white wordmark for a light background. */
  @Input() theme: 'dark' | 'light' = 'dark';
  /** Compact mode renders the branded M for the collapsed rail. */
  @Input() compact = false;
  //@Input() marginTop = '0';
}
