import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { WalletTransaction } from '../../../../core/wallet/wallet.models';
import { WalletDashboardFacade } from '../state/wallet-dashboard.facade';
import { WalletCashflowChartComponent } from '../cashflow/wallet-cashflow-chart.component';

/**
 * Wallet dashboard — desktop view.
 *
 * The template and layout are the original dashboard. All data and actions
 * now come from the shared page facade so the mobile view cannot drift.
 */
@Component({
  selector: 'async-wallet-dashboard-desktop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    PageSkeletonComponent,
    RouterModule,
    WalletCashflowChartComponent,
  ],
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
      </div>

      <async-wallet-cashflow-chart />

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
    .wallet-page { display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; margin-top: 16px; }
    .actions-row a { text-decoration: none; min-height: 44px; }
    .balance-hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 1fr); gap: 24px; padding: 24px; border-radius: var(--ms-radius-xl); background: linear-gradient(125deg, #667eea 0%, #764ba2 70%); color: #fff; box-shadow: var(--ms-shadow-md); }
    .balance-main { display: flex; flex-direction: column; gap: 4px; justify-content: center; }
    .balance-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.82); }
    .balance-value { font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.05; }
    .balance-note { color: rgba(255,255,255,0.82); font-size: 0.875rem; line-height: 1.5; max-width: 34em; }
    .balance-split { display: grid; grid-template-columns: 1fr; gap: 8px; align-content: center; }
    .balance-split div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 16px; border-radius: var(--ms-radius-md); background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); }
    .balance-split span { font-size: 0.8125rem; color: rgba(255,255,255,0.85); }
    .balance-split strong { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .actions-card { padding: 24px; }
    .actions-card h2 { margin: 0 0 16px; font-size: 1.125rem; }
    .actions-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
    .flow-card { display: flex; flex-direction: column; gap: 2px; padding: 16px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .flow-card mat-icon { color: var(--ms-primary-strong); }
    .flow-card span { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .flow-card strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .recent-card { padding: 24px; }
    .recent-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .recent-head h2 { margin: 0; font-size: 1.125rem; }
    .tx-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .tx-list li { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--ms-line); }
    .tx-list li:first-child { border-top: none; }
    .tx-list mat-icon { color: var(--ms-error); flex: none; }
    .tx-list mat-icon.credit { color: var(--ms-success); }
    .tx-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .tx-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tx-main span { font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tx-amount { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ms-error); }
    .tx-amount.credit { color: var(--ms-success); }
    .muted { color: var(--ms-text-muted); }
    @media (max-width: 800px) {
      .balance-hero { grid-template-columns: 1fr; }
    }
  `],
})
export class WalletDashboardDesktopComponent implements OnInit {
  private readonly facade = inject(WalletDashboardFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly balance = this.facade.balance;
  protected readonly moneyIn = this.facade.moneyIn;
  protected readonly moneyOut = this.facade.moneyOut;
  protected readonly txCount = this.facade.txCount;
  protected readonly pendingCommissions = this.facade.pendingCommissions;
  protected readonly releasedCommissions = this.facade.releasedCommissions;
  protected readonly campaignHeld = this.facade.campaignHeld;
  protected readonly recent = this.facade.recent;

  ngOnInit(): void {
    this.facade.ensureLoaded();
  }

  protected isCreditTx(tx: WalletTransaction): boolean {
    return this.facade.isCreditTx(tx);
  }

  protected money(value: number, decimals = 2): string {
    return this.facade.money(value, decimals);
  }

  protected creditMoney(value: number, credit: boolean): string {
    return this.facade.creditMoney(value, credit);
  }

  protected reload(): void {
    this.facade.reload();
  }
}
