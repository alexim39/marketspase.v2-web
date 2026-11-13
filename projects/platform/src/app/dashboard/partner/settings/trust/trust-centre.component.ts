import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { PartnerInterface, PartnerService } from '../../../../_common/services/partner.service';
import { OnboardingService } from '../../../../core/onboarding/onboarding.service';
import { OnboardingStatus } from '../../../../core/onboarding/onboarding.models';
import { CompensationService } from '../../../../core/compensation/compensation.service';
import { MyCompensation } from '../../../../core/compensation/compensation.models';
import { WalletService } from '../../../../core/wallet/wallet.service';
import { WalletTransaction } from '../../../../core/wallet/wallet.models';
import { StoreService } from '../../../../core/store/store.service';
import { StoreEarnings } from '../../../../core/store/store.models';
import { ApiError, userError } from '../../../../core/http/api-error';
import { DeleteAccountComponent } from '../profile-mgr/delete-account.component';

/**
 * Trust & compliance center — one place for identity, consent, statements,
 * data export, deletion and the plain-language earnings disclaimer.
 */
@Component({
  selector: 'async-trust-centre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DeleteAccountComponent, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/more">More</a> &gt;
        <span>Trust &amp; compliance</span>
      </div>
    </section>

    <section class="trust-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Account · Trust</p>
          <h1>Trust &amp; compliance center</h1>
          <p class="subtitle">Your identity, consent, records and data controls in one place. A real business needs clear records and plain answers.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/support/ticket">
          <mat-icon>support_agent</mat-icon>
          Contact support
        </a>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="trust and compliance" [showHeader]="false" />
      } @else {
        @if (error(); as err) {
          <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p></div>
        }

        <section class="status-grid" aria-label="Compliance status">
          <article class="status-card">
            <span class="status-icon" [class.status-icon--ok]="partner()?.kycStatus === 'verified'" [class.status-icon--warn]="partner()?.kycStatus === 'pending'">
              <mat-icon>verified_user</mat-icon>
            </span>
            <div><span>Identity / KYC</span><strong>{{ kycLabel(partner()?.kycStatus) }}</strong><small>{{ kycDetail() }}</small></div>
            <a mat-button routerLink="/dashboard/settings/verification">View</a>
          </article>
          <article class="status-card">
            <span class="status-icon status-icon--ok"><mat-icon>account_balance</mat-icon></span>
            <div><span>Payout readiness</span><strong>{{ payoutReady() ? 'Ready' : 'Finish setup' }}</strong><small>{{ payoutReady() ? 'KYC verified — withdrawals can be sent to your verified bank account.' : 'Verify your identity before withdrawing earnings.' }}</small></div>
            <a mat-button routerLink="/dashboard/settings/billing">Billing</a>
          </article>
          <article class="status-card">
            <span class="status-icon" [class.status-icon--ok]="!!partner()?.mentorContactConsentAt"><mat-icon>handshake</mat-icon></span>
            <div><span>Mentor consent</span><strong>{{ consentLabel() }}</strong><small>{{ consentDetail() }}</small></div>
            <a mat-button routerLink="/dashboard/settings/profiles">Profile</a>
          </article>
          <article class="status-card">
            <span class="status-icon status-icon--info"><mat-icon>calendar_month</mat-icon></span>
            <div><span>Member since</span><strong>{{ (onboarding()?.partner?.createdAt | date:'mediumDate') || '—' }}</strong><small>Records below cover your account, earnings and wallet activity.</small></div>
          </article>
        </section>

        <div class="trust-grid">
          <div class="main">
            <section class="panel">
              <div class="panel-head"><div><p class="eyebrow">Your records</p><h2>Statements and data</h2></div><span class="pill">{{ recordsCount() }} records</span></div>
              <div class="record-row">
                <span class="record-icon"><mat-icon>receipt_long</mat-icon></span>
                <div><strong>Earnings statement</strong><p>Commission entries, gross margin, rates and payout status.</p></div>
                <a mat-stroked-button routerLink="/dashboard/compensation">Open earnings</a>
              </div>
              <div class="record-row">
                <span class="record-icon"><mat-icon>account_balance_wallet</mat-icon></span>
                <div><strong>Wallet activity</strong><p>Deposits, withdrawals, refunds and released earnings.</p></div>
                <a mat-stroked-button routerLink="/dashboard/wallet/history">Open ledger</a>
              </div>
              <div class="record-row">
                <span class="record-icon"><mat-icon>download</mat-icon></span>
                <div><strong>Download my data</strong><p>A JSON copy of your profile, onboarding, earnings and wallet records.</p></div>
                <button mat-flat-button color="primary" type="button" (click)="exportData()" [disabled]="exporting()">
                  <mat-icon>download</mat-icon>
                  {{ exporting() ? 'Preparing…' : 'Export data' }}
                </button>
              </div>
              @if (exportNotice(); as note) {
                <p class="notice" role="status">{{ note }}</p>
              }
            </section>

            <section class="panel">
              <div class="panel-head"><div><p class="eyebrow">Compliance</p><h2>How earnings are described</h2></div></div>
              <div class="disclosure">
                <mat-icon>info</mat-icon>
                <div>
                  <p><strong>Income is not guaranteed.</strong> MarketSpase pays commissions from realised product gross margin after fulfilment. Results depend on product sales, team activity, rank, refunds and applicable qualification rules.</p>
                  <p>Campaign budgets are restricted advertising funds, not rank volume or guaranteed income. Store and resale margin are separate from platform commissions.</p>
                  <p>No one is promised a fixed monthly income, a specific rank or a specific number of allocated prospects. Review the plan in your Earnings hub before making decisions.</p>
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><div><p class="eyebrow">Your choice</p><h2>Consent and communication</h2></div></div>
              <div class="consent-grid">
                <div><span>Mentor contact</span><strong>{{ consentLabel() }}</strong><p>{{ consentDetail() }}</p></div>
                <div><span>Customer outreach</span><strong>Consent-based only</strong><p>WhatsApp, email and call shortcuts appear only where a customer opted in. Order contact details remain private.</p></div>
                <div><span>Ora approvals</span><strong>You approve every action</strong><p>Ora can prepare a message, but nothing is sent until you approve it and the backend re-checks consent.</p></div>
              </div>
              <a mat-stroked-button routerLink="/dashboard/settings/profiles">Manage consent</a>
            </section>

            <section class="panel">
              <div class="panel-head"><div><p class="eyebrow">Legal</p><h2>Policies and escalation</h2></div></div>
              <div class="link-list">
                <a href="https://marketspase.com/legal/terms" target="_blank" rel="noopener"><mat-icon>description</mat-icon>Terms of Service</a>
                <a href="https://marketspase.com/legal/privacy" target="_blank" rel="noopener"><mat-icon>privacy_tip</mat-icon>Privacy Policy</a>
                <a routerLink="/dashboard/support/ticket"><mat-icon>support_agent</mat-icon>Raise a complaint or support ticket</a>
                <a href="mailto:contacts@marketspase.com"><mat-icon>mail</mat-icon>Email the team</a>
              </div>
            </section>

            <async-delete-account />
          </div>

          <aside class="aside">
            <section class="aside-card">
              <div class="aside-head"><span class="aside-icon"><mat-icon>lock</mat-icon></span><h2>How we protect you</h2></div>
              <ul class="protect-list">
                <li><strong>Identity checks</strong> gate payouts and high-trust actions.</li>
                <li><strong>Consent gates</strong> stop outreach to customers who did not opt in.</li>
                <li><strong>Approval first</strong> — Ora never sends, moves money or changes a record without you.</li>
                <li><strong>Audit trails</strong> record sensitive account and earnings actions.</li>
                <li><strong>Data controls</strong> let you export or request deletion of your account.</li>
              </ul>
            </section>
            <section class="aside-card aside-card--accent">
              <div class="aside-head"><span class="aside-icon"><mat-icon>menu_book</mat-icon></span><h2>Need a human?</h2></div>
              <p>Support can explain a commission entry, a KYC decision, a withdrawal or a consent record.</p>
              <a mat-flat-button color="primary" routerLink="/dashboard/support/ticket">Open a ticket</a>
              <a mat-stroked-button href="mailto:contacts@marketspase.com">Email support</a>
            </section>
          </aside>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .trust-page { display: flex; flex-direction: column; gap: 24px; max-width: 1160px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); max-width: 62em; line-height: 1.6; }
    .page-head > a mat-icon { margin-right: 6px; }
    .status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .status-card { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: var(--ms-radius-md); }
    .status-icon { flex: none; width: 40px; height: 40px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-canvas); color: var(--ms-text-muted); }
    .status-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .status-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .status-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .status-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .status-card div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .status-card div > span { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .status-card strong { font-size: 0.9375rem; }
    .status-card small { color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.45; }
    .status-card a { flex: none; min-height: 36px; }
    .trust-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.7fr); gap: 24px; align-items: start; }
    .main { display: flex; flex-direction: column; gap: 16px; }
    .panel { padding: 24px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.125rem; }
    .pill { border-radius: 999px; padding: 4px 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; white-space: nowrap; }
    .record-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 0; border-top: 1px solid var(--ms-line); }
    .record-row:first-of-type { border-top: 0; }
    .record-icon { flex: none; width: 36px; height: 36px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .record-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .record-row > div { flex: 1; min-width: 200px; }
    .record-row strong { display: block; font-size: 0.875rem; }
    .record-row p { margin: 2px 0 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
    .record-row > a, .record-row > button { min-height: 40px; }
    .record-row > button mat-icon { margin-right: 4px; }
    .notice { margin: 10px 0 0; color: var(--ms-success); font-size: 0.8125rem; }
    .disclosure { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); color: var(--ms-text-muted); }
    .disclosure mat-icon { color: var(--ms-primary-strong); flex: none; }
    .disclosure p { margin: 0 0 8px; font-size: 0.8125rem; line-height: 1.6; }
    .disclosure p:last-child { margin-bottom: 0; }
    .disclosure strong { color: var(--ms-text); }
    .consent-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .consent-grid > div { padding: 12px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); }
    .consent-grid span { display: block; color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .consent-grid strong { display: block; margin: 4px 0; font-size: 0.875rem; }
    .consent-grid p { margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
    .link-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .link-list a { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); text-decoration: none; color: var(--ms-text); font-size: 0.8125rem; }
    .link-list a:hover { border-color: var(--ms-primary); }
    .link-list mat-icon { color: var(--ms-primary-strong); font-size: 18px; width: 18px; height: 18px; }
    .aside { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 96px; }
    .aside-card { padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); display: flex; flex-direction: column; gap: 12px; }
    .aside-card--accent { background: linear-gradient(135deg, var(--ms-primary-soft), var(--ms-surface)); border-color: var(--ms-primary); }
    .aside-head { display: flex; align-items: center; gap: 10px; }
    .aside-head h2 { margin: 0; font-size: 0.9375rem; }
    .aside-icon { width: 32px; height: 32px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .aside-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .protect-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.5; }
    .protect-list strong { color: var(--ms-text); }
    .aside-card p { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.6; }
    .aside-card a { min-height: 40px; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    @media (max-width: 1000px) {
      .status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .trust-grid { grid-template-columns: minmax(0, 1fr); }
      .aside { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .status-grid, .consent-grid, .link-list, .aside { grid-template-columns: minmax(0, 1fr); }
      .panel { padding: 16px; }
    }
  `],
})
export class TrustCentreComponent implements OnInit {
  private readonly partners = inject(PartnerService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly compensation = inject(CompensationService);
  private readonly wallet = inject(WalletService);
  private readonly store = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exportNotice = signal<string | null>(null);
  protected readonly partner = signal<PartnerInterface | null>(null);
  protected readonly onboarding = signal<OnboardingStatus | null>(null);
  private compensationData: MyCompensation | null = null;
  private walletRows: WalletTransaction[] = [];
  private storeData: StoreEarnings | null = null;

  ngOnInit(): void {
    forkJoin({
      partner: this.partners.getSharedPartnerData$.pipe(catchError(() => of(null))),
      onboarding: this.onboardingService.status().pipe(catchError(() => of(null))),
      compensation: this.compensation.me().pipe(catchError(() => of(null))),
      wallet: this.wallet.history().pipe(catchError(() => of([]))),
      store: this.store.earnings().pipe(catchError(() => of(null))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ partner, onboarding, compensation, wallet, store }) => {
        this.partner.set(partner ?? null);
        this.onboarding.set(onboarding?.data ?? null);
        this.compensationData = compensation?.data ?? null;
        this.walletRows = wallet ?? [];
        this.storeData = store?.data ?? null;
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(userError(err));
        this.loading.set(false);
      },
    });
  }

  protected kycLabel(status?: string): string {
    switch (status) {
      case 'verified': return 'Verified';
      case 'pending': return 'Under review';
      case 'rejected': return 'Rejected';
      default: return 'Not started';
    }
  }

  protected kycDetail(): string {
    const kyc = this.onboarding()?.kyc;
    if (!kyc) return 'Complete the identity step to unlock withdrawals and high-trust actions.';
    if (kyc.status === 'verified') return `Verified ${kyc.reviewedAt ? new Date(kyc.reviewedAt).toLocaleDateString() : ''}`.trim();
    if (kyc.status === 'pending') return 'Submitted — review is in progress.';
    if (kyc.status === 'rejected') return kyc.reviewNote || 'Review the rejection note and resubmit.';
    return 'Complete the identity step to unlock withdrawals.';
  }

  protected payoutReady(): boolean {
    return this.partner()?.kycStatus === 'verified';
  }

  protected consentLabel(): string {
    const preference = this.partner()?.mentorContactPreference;
    if (!preference) return 'Not set';
    if (preference === 'prefer_not_now') return 'Paused';
    if (preference === 'in_app') return 'In-app only';
    return `Via ${preference}`;
  }

  protected consentDetail(): string {
    const partner = this.partner();
    if (!partner?.mentorContactPreference || partner.mentorContactPreference === 'prefer_not_now') {
      return 'No direct mentor outreach is active. You can change this in your profile.';
    }
    if (partner.mentorContactConsentAt) {
      return `Consent recorded ${new Date(partner.mentorContactConsentAt).toLocaleDateString()}.`;
    }
    return 'Your mentor uses the channel you selected in your profile.';
  }

  protected recordsCount(): number {
    return (this.compensationData?.entries.length ?? 0) + this.walletRows.length + (this.storeData?.paidOrders ?? 0);
  }

  protected exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportNotice.set(null);
    forkJoin({
      partner: this.partners.getSharedPartnerData$.pipe(catchError(() => of(null))),
      onboarding: this.onboardingService.status().pipe(catchError(() => of(null))),
      compensation: this.compensation.me().pipe(catchError(() => of(null))),
      wallet: this.wallet.history().pipe(catchError(() => of([]))),
      store: this.store.earnings().pipe(catchError(() => of(null))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        const payload = {
          exportedAt: new Date().toISOString(),
          account: data.partner,
          onboarding: data.onboarding?.data ?? null,
          earnings: data.compensation?.data ?? null,
          wallet: data.wallet ?? [],
          storeEarnings: data.store?.data ?? null,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `marketspase-my-data-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
        this.exportNotice.set('Your data export has been downloaded.');
      },
      error: (err: ApiError) => {
        this.exporting.set(false);
        this.error.set(userError(err));
      },
    });
  }
}
