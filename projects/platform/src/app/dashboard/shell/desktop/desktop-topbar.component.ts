import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { PwaInstallService } from '../../../core/pwa/pwa-install.service';
import { NotificationStreamService } from '../../../core/notifications/notification-stream.service';
import { NotificationBellComponent } from '../../notifications/bell/notification-bell.component';

/**
 * Desktop command-centre topbar. Preserved from the original shell so the
 * desktop rendering stays pixel-identical while the mobile bar is independent.
 */
@Component({
  selector: 'async-desktop-dashboard-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    RouterModule,
    NotificationBellComponent,
  ],
  template: `
    <mat-toolbar class="ms-topbar" role="banner">
      <span class="ms-page-title">{{ pageTitle() }}</span>
      <span class="ms-spacer"></span>

      <div class="ms-top-actions">
        <button mat-icon-button (click)="search.emit()" title="Search (Ctrl+K)" aria-label="Search">
          <mat-icon aria-hidden="true">search</mat-icon>
        </button>

        <button mat-icon-button [matMenuTriggerFor]="createMenu" title="Create" aria-label="Create">
          <mat-icon aria-hidden="true">add</mat-icon>
        </button>

        @if (isAdmin()) {
          <a mat-icon-button [href]="adminUrl()" target="_blank" rel="noopener" title="Admin console" aria-label="Open the admin console">
            <mat-icon aria-hidden="true">admin_panel_settings</mat-icon>
          </a>
        }

        @if (install.canInstall()) {
          <button mat-icon-button (click)="installApp()" title="Install MarketSpase app" aria-label="Install MarketSpase app">
            <mat-icon aria-hidden="true">install_mobile</mat-icon>
          </button>
        }

        <button mat-icon-button [matMenuTriggerFor]="notifMenu" title="Notifications" [attr.aria-label]="stream.unreadCount() ? 'Notifications, ' + stream.unreadCount() + ' unread' : 'Notifications'">
          <mat-icon aria-hidden="false" [attr.aria-label]="stream.unreadCount() ? 'Notifications, ' + stream.unreadCount() + ' unread' : 'Notifications'" [matBadge]="stream.unreadCount()" [matBadgeHidden]="stream.unreadCount() === 0" matBadgeColor="warn" matBadgeDescription="unread notifications">notifications</mat-icon>
        </button>

        <button mat-icon-button (click)="signOut.emit()" title="Sign out" aria-label="Sign out">
          <mat-icon aria-hidden="true">power_settings_circle</mat-icon>
        </button>
      </div>
    </mat-toolbar>

    <mat-menu #createMenu="matMenu" class="ms-create-menu">
      <a mat-menu-item routerLink="/dashboard/wallet/deposit"><mat-icon>add_card</mat-icon> Deposit funds</a>
      <a mat-menu-item routerLink="/dashboard/settings/billing"><mat-icon>paid</mat-icon> Withdraw funds</a>
      <a mat-menu-item routerLink="/dashboard/prospects/new"><mat-icon>person_add</mat-icon> Add prospect</a>
      <a mat-menu-item routerLink="/dashboard/campaigns"><mat-icon>campaign</mat-icon> Start campaign</a>
      <a mat-menu-item routerLink="/dashboard/messages"><mat-icon>forum</mat-icon> Send message</a>
      <a mat-menu-item routerLink="/dashboard/ora"><mat-icon>smart_toy</mat-icon> Ask Ora</a>
    </mat-menu>

    <mat-menu #notifMenu="matMenu" panelClass="notif-menu-panel">
      <async-notification-bell />
    </mat-menu>
  `,
  styles: [`
    :host { display: block; }

    .ms-topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 64px;
      padding: 0 24px;
      background: color-mix(in srgb, var(--ms-surface) 88%, transparent);
      backdrop-filter: saturate(160%) blur(14px);
      color: var(--ms-text);
      border-bottom: 1px solid var(--ms-line);
    }

    .ms-page-title {
      font-size: 1.02em;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--ms-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ms-spacer { flex: 1; }

    .ms-top-actions {
      display: flex;
      align-items: center;
      gap: 0.15em;
    }

    .ms-top-actions a { color: var(--ms-text); }
  `],
})
export class DesktopDashboardTopbarComponent {
  protected readonly stream = inject(NotificationStreamService);
  protected readonly install = inject(PwaInstallService);

  readonly pageTitle = input('Dashboard');
  readonly isAdmin = input(false);
  readonly adminUrl = input('');

  readonly search = output<void>();
  readonly signOut = output<void>();

  protected installApp(): void {
    void this.install.promptInstall();
  }
}
