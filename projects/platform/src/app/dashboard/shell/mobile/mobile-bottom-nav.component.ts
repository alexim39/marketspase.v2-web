import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

/** Fixed primary navigation for the mobile dashboard. */
@Component({
  selector: 'async-mobile-dashboard-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterModule],
  template: `
    <nav class="ms-mobile-bottom-nav" aria-label="Primary">
      <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="scrollToTop()">
        <mat-icon aria-hidden="true">home</mat-icon><span>Home</span>
      </a>
      <a routerLink="/dashboard/pipeline" routerLinkActive="active" (click)="scrollToTop()">
        <mat-icon aria-hidden="true">person_search</mat-icon><span>Pipeline</span>
      </a>
      <a routerLink="/dashboard/products" routerLinkActive="active" (click)="scrollToTop()">
        <mat-icon aria-hidden="true">storefront</mat-icon><span>Products</span>
      </a>
      <a routerLink="/dashboard/wallet" routerLinkActive="active" (click)="scrollToTop()">
        <mat-icon aria-hidden="true">payments</mat-icon><span>Wallet</span>
      </a>
      <button type="button" (click)="more.emit()" aria-label="More sections">
        <mat-icon aria-hidden="true">more_horiz</mat-icon><span>More</span>
      </button>
    </nav>
  `,
  styles: [`
    :host { display: block; }

    .ms-mobile-bottom-nav {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 1000;
      display: flex;
      padding-right: var(--ms-safe-right);
      padding-bottom: var(--ms-safe-bottom);
      padding-left: var(--ms-safe-left);
      border-top: 1px solid var(--ms-line);
      background: color-mix(in srgb, var(--ms-surface) 92%, transparent);
      backdrop-filter: blur(16px) saturate(160%);
    }

    a,
    button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 64px;
      padding: 8px 0;
      border: 0;
      background: none;
      color: var(--ms-text-muted);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }

    mat-icon {
      width: 24px;
      height: 24px;
      font-size: 24px;
    }

    a.active {
      color: var(--ms-primary-strong);
      font-weight: 700;
    }

    a:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--ms-primary);
      outline-offset: -2px;
    }
  `],
})
export class MobileDashboardBottomNavComponent {
  readonly more = output<void>();

  protected scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
