import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { PwaInstallService } from '../../../core/pwa/pwa-install.service';
import { NotificationStreamService } from '../../../core/notifications/notification-stream.service';
import { NotificationBellComponent } from '../../notifications/bell/notification-bell.component';

/**
 * Native-style mobile command-centre app bar.
 *
 * Keeps the primary actions (search, notifications) one tap away and moves the
 * create/admin/install/sign-out set into a bottom-anchored menu.
 */
@Component({
  selector: 'async-mobile-dashboard-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BrandLogoComponent,
    MatBadgeModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    RouterModule,
    NotificationBellComponent,
  ],
  template: `
    <header class="ms-mobile-dashboard-topbar" role="banner">
      <div class="bar">
        <button type="button" class="icon-btn" (click)="menu.emit()" aria-label="Open navigation">
          <mat-icon aria-hidden="true">menu</mat-icon>
        </button>

        <a routerLink="/dashboard" class="brand" aria-label="MarketSpase dashboard">
          <async-brand-logo
            [variant]="theme() === 'light' ? 'full-dark' : 'full-white'"
            height="26px"
            alt=""
          />
        </a>

        <span class="spacer"></span>

        <button type="button" class="icon-btn" (click)="search.emit()" aria-label="Search">
          <mat-icon aria-hidden="true">search</mat-icon>
        </button>

        <button
          type="button"
          class="icon-btn"
          [matMenuTriggerFor]="notifMenu"
          [attr.aria-label]="stream.unreadCount() ? 'Notifications, ' + stream.unreadCount() + ' unread' : 'Notifications'"
        >
          <mat-icon
            aria-hidden="true"
            [matBadge]="stream.unreadCount()"
            [matBadgeHidden]="stream.unreadCount() === 0"
            matBadgeColor="warn"
            matBadgeDescription="unread notifications"
          >notifications</mat-icon>
        </button>

        <button type="button" class="icon-btn" [matMenuTriggerFor]="moreMenu" aria-label="More actions">
          <mat-icon aria-hidden="true">more_vert</mat-icon>
        </button>
      </div>
    </header>

    <mat-menu #moreMenu="matMenu" panelClass="ms-mobile-more-menu">
      <a mat-menu-item routerLink="/dashboard/wallet/deposit"><mat-icon>add_card</mat-icon> Deposit funds</a>
      <a mat-menu-item routerLink="/dashboard/settings/billing"><mat-icon>paid</mat-icon> Withdraw funds</a>
      <a mat-menu-item routerLink="/dashboard/prospects/new"><mat-icon>person_add</mat-icon> Add prospect</a>
      <a mat-menu-item routerLink="/dashboard/campaigns"><mat-icon>campaign</mat-icon> Start campaign</a>
      <a mat-menu-item routerLink="/dashboard/messages"><mat-icon>forum</mat-icon> Send message</a>
      <a mat-menu-item routerLink="/dashboard/ora"><mat-icon>smart_toy</mat-icon> Ask Ora</a>

      @if (install.canInstall() || isAdmin()) {
        <mat-divider />
      }

      @if (install.canInstall()) {
        <button mat-menu-item type="button" (click)="installApp()">
          <mat-icon>install_mobile</mat-icon> Install app
        </button>
      }

      @if (isAdmin()) {
        <a mat-menu-item [href]="adminUrl()" target="_blank" rel="noopener">
          <mat-icon>admin_panel_settings</mat-icon> Admin console
        </a>
      }

      <mat-divider />
      <button mat-menu-item type="button" (click)="signOut.emit()">
        <mat-icon>power_settings_circle</mat-icon> Sign out
      </button>
    </mat-menu>

    <mat-menu #notifMenu="matMenu" panelClass="ms-mobile-notif-menu">
      <async-notification-bell />
    </mat-menu>
  `,
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .ms-mobile-dashboard-topbar {
      padding-top: var(--ms-safe-top);
      border-bottom: 1px solid var(--ms-line);
      background: color-mix(in srgb, var(--ms-surface) 92%, transparent);
      backdrop-filter: saturate(160%) blur(16px);
      color: var(--ms-text);
      box-sizing: border-box;
    }

    .bar {
      display: flex;
      align-items: center;
      gap: 2px;
      min-height: var(--ms-mobile-appbar-height);
      padding: 0 8px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      margin: 0 6px;
      text-decoration: none;
    }

    .spacer { flex: 1; }

    .icon-btn {
      display: inline-grid;
      width: var(--ms-touch-target);
      height: var(--ms-touch-target);
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: var(--ms-radius-md);
      background: transparent;
      color: var(--ms-text);
      cursor: pointer;
    }

    .icon-btn:hover,
    .icon-btn:focus-visible {
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .icon-btn mat-icon {
      font-size: 23px;
      width: 23px;
      height: 23px;
    }
  `],
})
export class MobileDashboardTopbarComponent {
  protected readonly stream = inject(NotificationStreamService);
  protected readonly install = inject(PwaInstallService);
  protected readonly theme = inject(ThemeService).theme;

  readonly isAdmin = input(false);
  readonly adminUrl = input('');

  readonly menu = output<void>();
  readonly search = output<void>();
  readonly signOut = output<void>();

  protected installApp(): void {
    void this.install.promptInstall();
  }
}
