import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { WalletService } from '../../../core/wallet/wallet.service';
import { WalletTransaction } from '../../../core/wallet/wallet.models';
import { BillingService } from '../../../core/billing/billing.service';
import { PerformanceData } from '../../../core/billing/billing.models';
import { CompensationService } from '../../../core/compensation/compensation.service';
import { MyCompensation } from '../../../core/compensation/compensation.models';
import { CampaignsService } from '../../../core/campaigns/campaigns.service';
import { GrowthCampaign } from '../../../core/campaigns/campaigns.models';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { ApiError } from '../../../core/http/api-error';
import { formatMoney, formatSignedMoney, isWalletCredit } from '../../../core/format/money';

/**
 * Wallet dashboard — balance, cashflow, commissions and campaign budget held.
 * Read-only over existing records; money moves via deposit, withdrawals
 * (settings/billing) and product purchases.
 */
@Component({
  selector: 'async-wallet-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, EmptyStateComponent, ErrorStateComponent, MatButtonModule, MatCardModule, MatIconModule, PageHeaderComponent, PageSkeletonComponent, RouterModule],
  template: `
    <section class="wallet-page">
      <async-page-header
        eyebrow="Wallet · Money clarity"
        title="Every naira, accounted for."
        subtitle="Available balance, commissions, campaign budget held and every movement in one place."
      >
        <a mat-flat-button color="primary" routerLink="/dashboard/wallet/deposit"><mat-icon>add_card</mat-icon> Deposit</a>
      </async-page-header>

      @if (loading()) {
        <async-page-skeleton layout="wallet" [rows]="3" label="wallet" [showHeader]="false" />
      }

      @if (error(); as err) {
        <async-error-state [message]="err" context="your wallet">
          <button mat-stroked-button type="button" (click)="reload()">Try again</button>
          <a mat-button routerLink="/dashboard">Back to dashboard</a>
        </async-error-state>
      }

      @if (!loading() && !error()) {
      <!-- Balance hero -->
      <div class="balance-hero">
        <div class="balance-main">
          <span class="balance-label">Available balance</span>
          <strong class="balance-value">{{ money(balance()) }}</strong>
          <span class="balance-note">Campaign budgets are debited when funded; unspent budget returns on close-out.</span>
        </div>
        <div class="balance-split">
          <div>
            <span>Pending commissions</span>
            <strong>{{ money(pendingCommissions()) }}</strong>
          </div>
          <div>
            <span>Released commissions</span>
            <strong>{{ money(releasedCommissions()) }}</strong>
          </div>
          <div>
            <span>Campaign budget held</span>
            <strong>{{ money(campaignHeld()) }}</strong>
          </div>
        </div>
      </div>

      <!-- Money tools -->
      <div class="dp-card actions-card">
        <h2>Money tools</h2>
        <div class="actions-row">
          <a mat-stroked-button routerLink="/dashboard/settings/billing"><mat-icon>account_balance</mat-icon> Withdraw</a>
          <a mat-button routerLink="/dashboard/compensation"><mat-icon>workspace_premium</mat-icon> Commissions</a>
          <a mat-button routerLink="/dashboard/wallet/history"><mat-icon>history</mat-icon> Full history</a>
        </div>
      </div>

      <!-- Cashflow -->
      <div class="flow-grid">
        <div class="flow-card">
          <mat-icon>arrow_downward</mat-icon>
          <span>Money in</span>
          <strong>{{ money(moneyIn()) }}</strong>
        </div>
        <div class="flow-card">
          <mat-icon>arrow_upward</mat-icon>
          <span>Money out</span>
          <strong>{{ money(moneyOut()) }}</strong>
        </div>
        <div class="flow-card">
          <mat-icon>receipt_long</mat-icon>
          <span>Transactions</span>
          <strong>{{ txCount() | number }}</strong>
        </div>
        <div class="flow-card">
          <mat-icon>trending_up</mat-icon>
          <span>Personal shop volume</span>
          <strong>{{ money(personalVolume()) }}</strong>
        </div>
      </div>

      <!-- Recent activity -->
      <div class="dp-card recent-card">
        <div class="recent-head">
          <h2>Recent transactions</h2>
          <a mat-button routerLink="/dashboard/wallet/history">View all</a>
        </div>
        @if (recent().length === 0) {
          <async-empty-state
            icon="receipt_long"
            title="No wallet movements yet"
            message="No money has moved through this wallet."
            reason="No deposit, commission or campaign charge has been recorded."
            next="Deposit funds or open a campaign to create the first entry."
          />
        } @else {
          <ul class="tx-list">
            @for (tx of recent(); track tx.id) {
              <li>
                <mat-icon [class.credit]="isCreditTx(tx)">{{ isCreditTx(tx) ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
                <div class="tx-main">
                  <strong>{{ tx.type || tx.method || 'Transaction' }}</strong>
                  <span class="muted">{{ tx.at | date:'mediumDate' }} · {{ tx.reference || tx.status }}</span>
                </div>
                <span class="tx-amount" [class.credit]="isCreditTx(tx)">
                  {{ creditMoney(tx.amount, isCreditTx(tx)) }}
                </span>
              </li>
            }
          </ul>
        }
      </div>
      }
    </section>
  `,
  styles: [`
    .wallet-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; margin-top: 1em; }
    .actions-row a { text-decoration: none; min-height: 44px; }
    .balance-hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 1fr); gap: 1.5em; padding: 1.4em 1.5em; border-radius: var(--ms-radius-xl); background: linear-gradient(125deg, #667eea 0%, #764ba2 70%); color: #fff; box-shadow: var(--ms-shadow-md); }
    .balance-main { display: flex; flex-direction: column; gap: 0.3em; justify-content: center; }
    .balance-label { font-size: 0.76em; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.82); }
    .balance-value { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .balance-note { color: rgba(255,255,255,0.82); font-size: 0.84em; line-height: 1.45; max-width: 34em; }
    .balance-split { display: grid; grid-template-columns: 1fr; gap: 8px; align-content: center; }
    .balance-split div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 12px; border-radius: var(--ms-radius-md); background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); }
    .balance-split span { font-size: 0.82em; color: rgba(255,255,255,0.85); }
    .balance-split strong { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .actions-card { padding: 1em 1.1em; }
    .actions-card h2 { margin: 0 0 0.6em; font-size: 1.15rem; }
    .actions-row { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75em; }
    .flow-card { display: flex; flex-direction: column; gap: 0.15em; padding: 0.9em 1em; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); }
    .flow-card mat-icon { color: var(--ms-primary-strong); }
    .flow-card span { color: var(--ms-text-muted); font-size: 0.78em; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .flow-card strong { font-size: 1.25em; font-variant-numeric: tabular-nums; }
    .recent-card { padding: 1em 1.1em; }
    .recent-head { display: flex; justify-content: space-between; align-items: center; gap: 1em; flex-wrap: wrap; }
    .recent-head h2 { margin: 0; font-size: 1.15rem; }
    .tx-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .tx-list li { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-top: 1px solid var(--ms-line); }
    .tx-list li:first-child { border-top: none; }
    .tx-list mat-icon { color: var(--ms-error); flex: none; }
    .tx-list mat-icon.credit { color: var(--ms-success); }
    .tx-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .tx-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tx-main span { font-size: 0.8em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tx-amount { flex: none; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ms-error); }
    .tx-amount.credit { color: var(--ms-success); }
    .muted { color: var(--ms-text-muted); }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    @media (max-width: 800px) {
      .balance-hero { grid-template-columns: 1fr; }
    }
  `],
})
export class WalletDashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletService);
  private readonly billing = inject(BillingService);
  private readonly compensationSvc = inject(CompensationService);
  private readonly campaignsSvc = inject(CampaignsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly txs = signal<WalletTransaction[]>([]);
  protected readonly perf = signal<PerformanceData | null>(null);
  protected readonly compensation = signal<MyCompensation | null>(null);
  protected readonly campaigns = signal<GrowthCampaign[]>([]);

  protected readonly balance = computed(() => Number(this.auth.currentUser()?.['balance'] ?? 0));
  protected readonly moneyIn = computed(() => this.txs().reduce((sum, t) => isWalletCredit(t) ? sum + Math.abs(Number(t.amount) || 0) : sum, 0));
  protected readonly moneyOut = computed(() => this.txs().reduce((sum, t) => !isWalletCredit(t) ? sum + Math.abs(Number(t.amount) || 0) : sum, 0));
  protected readonly txCount = computed(() => this.txs().length);
  protected readonly pendingCommissions = computed(() => Number(this.compensation()?.summary?.pending ?? 0));
  protected readonly releasedCommissions = computed(() => Number(this.compensation()?.summary?.released ?? 0));
  protected readonly personalVolume = computed(() => Number(this.perf()?.personalVolume ?? 0));
  protected readonly campaignHeld = computed(() => this.campaigns()
    .filter((c) => c.status !== 'Ended' && c.status !== 'Cancelled')
    .reduce((sum, c) => sum + Number(c.budget?.remaining ?? 0), 0));
  protected readonly recent = computed(() => [...this.txs()]
    .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
    .slice(0, 6));

  ngOnInit(): void {
    this.reload();
  }

  protected isCreditTx(tx: WalletTransaction): boolean {
    return isWalletCredit(tx);
  }

  protected money(value: number, decimals = 2): string {
    return formatMoney(value, decimals);
  }

  protected creditMoney(value: number, credit: boolean): string {
    return formatSignedMoney(value, credit);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    // Resolve the session first so WalletService can address the owner-scoped history.
    this.auth.me().pipe(
      catchError(() => of(null)),
      switchMap(() => forkJoin({
        txs: this.wallet.history().pipe(catchError(() => of([]))),
        perf: this.billing.performance().pipe(catchError(() => of(null))),
        compensation: this.compensationSvc.me().pipe(catchError(() => of(null))),
        campaigns: this.campaignsSvc.mine().pipe(catchError(() => of(null))),
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ txs, perf, compensation, campaigns }) => {
        this.txs.set(txs ?? []);
        this.perf.set(perf?.data ?? null);
        this.compensation.set(compensation?.data ?? null);
        this.campaigns.set(campaigns?.data ?? []);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}
