import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';

interface MoreLink {
  label: string;
  detail: string;
  icon: string;
  link?: string;
  external?: string;
}

interface MoreGroup {
  key: string;
  label: string;
  icon: string;
  links: MoreLink[];
}

/**
 * More hub — account, insights, support and admin entry in one landing.
 * Replaces the old redirect to settings for `/dashboard/more`.
 */
@Component({
  selector: 'async-more-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="more-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">More · Account & utilities</p>
          <h1>Everything else, one tap away</h1>
          <p class="muted">Your account, insights, support and admin tools.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/dashboard/settings/profiles">Edit account</a>
      </header>

      <!-- Account card -->
      <div class="account-card">
        <div class="avatar" aria-hidden="true">{{ initials() }}</div>
        <div class="account-main">
          <strong>{{ user()?.name }} {{ user()?.surname }}</strong>
          <span class="muted">@{{ user()?.username }} · {{ user()?.email }}</span>
          <div class="chips">
            <span class="chip">{{ roleLabel() }}</span>
            <span class="chip">{{ accountLabel() }}</span>
            <span class="chip">KYC {{ kycLabel() }}</span>
          </div>
        </div>
        <div class="completeness">
          <span>Profile completeness</span>
          <strong>{{ profilePercent() }}%</strong>
          <div class="meter"><span [style.width.%]="profilePercent()"></span></div>
          @if (profilePercent() < 100) {
            <a mat-button routerLink="/dashboard/settings/profiles">Complete profile</a>
          }
        </div>
      </div>

      <div class="groups">
        @for (group of groups; track group.key) {
          <section class="group">
            <h2><mat-icon>{{ group.icon }}</mat-icon>{{ group.label }}</h2>
            <div class="link-grid">
              @for (item of group.links; track item.label) {
                @if (item.external) {
                  <a class="link-card" [href]="item.external" target="_blank" rel="noopener">
                    <mat-icon>{{ item.icon }}</mat-icon>
                    <strong>{{ item.label }}</strong>
                    <span class="muted">{{ item.detail }}</span>
                  </a>
                } @else if (item.link) {
                  <a class="link-card" [routerLink]="item.link">
                    <mat-icon>{{ item.icon }}</mat-icon>
                    <strong>{{ item.label }}</strong>
                    <span class="muted">{{ item.detail }}</span>
                  </a>
                }
              }
            </div>
          </section>
        }

        @if (isAdmin()) {
          <section class="group">
            <h2><mat-icon>admin_panel_settings</mat-icon>Admin</h2>
            <div class="link-grid">
              <a class="link-card link-card--admin" [href]="adminUrl" target="_blank" rel="noopener">
                <mat-icon>open_in_new</mat-icon>
                <strong>Admin console</strong>
                <span class="muted">Opens the standalone admin app for money, growth, commerce and members.</span>
              </a>
            </div>
          </section>
        }
      </div>
    </section>
  `,
  styles: [`
    .more-page { max-width: 1180px; margin: 0 auto; padding: 24px 0 48px; display: flex; flex-direction: column; gap: 18px; }
    .page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(1.7rem, 3vw, 2.4rem); line-height: 1.1; letter-spacing: -0.03em; }
    .page-head p { margin: 0; line-height: 1.55; max-width: 620px; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .account-card { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 18px 20px; border-radius: var(--ms-radius-lg); background: linear-gradient(120deg, var(--ms-primary-soft), var(--ms-surface) 62%); border: 1px solid var(--ms-line); box-shadow: var(--ms-shadow-sm); }
    .avatar { width: 56px; height: 56px; flex: none; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; font-size: 1.2em; font-weight: 800; }
    .account-main { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 2px; }
    .account-main strong { font-size: 1.15em; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; }
    .chip { border-radius: 999px; background: var(--ms-surface); border: 1px solid var(--ms-line); padding: 3px 9px; font-size: 0.74em; font-weight: 700; color: var(--ms-text-muted); }
    .completeness { flex: none; width: min(240px, 100%); display: flex; flex-direction: column; gap: 4px; }
    .completeness > span { font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ms-text-muted); }
    .completeness strong { font-size: 1.3em; }
    .meter { height: 8px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; }
    .meter span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--ms-primary), var(--ms-secondary)); }
    .completeness a { align-self: flex-start; min-height: 36px; }
    .groups { display: grid; gap: 18px; }
    .group h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 1.05em; }
    .group h2 mat-icon { color: var(--ms-primary-strong); }
    .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .link-card { display: flex; flex-direction: column; gap: 3px; padding: 14px 15px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); background: var(--ms-surface); color: var(--ms-text); text-decoration: none; min-height: 92px; transition: background 150ms ease, border-color 150ms ease; }
    .link-card:hover { background: var(--ms-primary-soft); border-color: var(--ms-primary); }
    .link-card mat-icon { color: var(--ms-primary-strong); margin-bottom: 2px; }
    .link-card strong { font-size: 0.95em; }
    .link-card span { font-size: 0.8em; line-height: 1.4; }
    .link-card--admin { border-color: var(--ms-primary); }
    @media (max-width: 700px) {
      .page-head { flex-direction: column; }
      .completeness { width: 100%; }
    }
  `],
})
export class MoreHubComponent {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.currentUser;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly adminUrl = environment.adminUrl;

  protected readonly groups: MoreGroup[] = [
    {
      key: 'account',
      label: 'Account',
      icon: 'person',
      links: [
        { label: 'Settings', detail: 'Profile, contact details, security and billing.', icon: 'settings', link: '/dashboard/settings/profiles' },
        { label: 'Appearance', detail: 'Light, dark or system theme for this device.', icon: 'palette', link: '/dashboard/settings/appearance' },
        { label: 'Verification & KYC', detail: 'Identity status, age check and review notes.', icon: 'verified_user', link: '/dashboard/settings/verification' },
        { label: 'Billing & withdrawals', detail: 'Bank account, deposits and withdrawals.', icon: 'account_balance', link: '/dashboard/settings/billing' },
        { label: 'Personal page', detail: 'Set up the public lead page prospects see.', icon: 'public', link: '/dashboard/settings/landing-page' },
        { label: 'Notification settings', detail: 'Channels and categories.', icon: 'notifications', link: '/dashboard/notifications/preferences' },
        { label: 'Notifications center', detail: 'Everything that needs your attention.', icon: 'inbox', link: '/dashboard/notifications/center' },
      ],
    },
    {
      key: 'insights',
      label: 'Insights',
      icon: 'insights',
      links: [
        { label: "How I'm doing", detail: 'Personal and team health summary.', icon: 'monitoring', link: '/dashboard/insights' },
        { label: 'My Business', detail: 'Your numbers and next moves in one screen.', icon: 'business_center', link: '/dashboard/insights/my-business' },
        { label: 'Reports & downloads', detail: 'Export your business data.', icon: 'download', link: '/dashboard/insights/downloads' },
      ],
    },
    {
      key: 'support',
      label: 'Support & help',
      icon: 'support_agent',
      links: [
        { label: 'Ask Ora', detail: 'Context-aware growth coach.', icon: 'smart_toy', link: '/dashboard/ora' },
        { label: 'Get help', detail: 'Submit a support ticket and track it.', icon: 'help', link: '/dashboard/support/ticket' },
        { label: 'About', detail: 'About this app and the platform.', icon: 'info', link: '/dashboard/support/about/app' },
      ],
    },
  ];

  protected initials(): string {
    const u = this.user();
    return `${u?.name?.[0] ?? ''}${u?.surname?.[0] ?? ''}`.toUpperCase() || 'MS';
  }

  protected roleLabel(): string {
    if (this.auth.role() === 'admin') return 'Admin';
    return this.user()?.commissionRank ?? 'Partner';
  }

  protected accountLabel(): string {
    const state = this.user()?.accountState;
    return state === 'partner' ? 'Activated partner' : 'Member';
  }

  protected kycLabel(): string {
    const status = this.user()?.kycStatus ?? 'not_started';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  protected profilePercent(): number {
    const u = this.user() as unknown as { phone?: unknown; address?: { street?: unknown; city?: unknown; state?: unknown }; profileImage?: unknown } | null;
    const filled = (v: unknown): boolean => String(v ?? '').trim().length > 0;
    const checks = [
      filled(u?.phone),
      filled(u?.address?.street),
      filled(u?.address?.city),
      filled(u?.address?.state),
      filled(u?.profileImage),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }
}
