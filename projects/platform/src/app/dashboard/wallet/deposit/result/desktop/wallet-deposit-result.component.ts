import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { WalletDepositResultFacade } from '../state/wallet-deposit-result.facade';

@Component({
  selector: 'async-wallet-deposit-result-desktop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/wallet">Wallet</a> &gt;
        <span>Deposit result</span>
      </div>
    </section>

    <section class="result-page">
      <div class="dp-card result-card" role="status">
        @if (state() === 'checking') {
          <mat-progress-bar mode="indeterminate" aria-label="Loading" />
          <h2>Confirming your payment…</h2>
          <p class="muted">Asking the payment provider directly — this can take a few seconds after you pay.</p>
        } @else if (state() === 'success') {
          <mat-icon class="ok">check_circle</mat-icon>
          <h2>₦{{ amount() | number }} added to your wallet</h2>
          <p class="muted">Reference {{ reference() }}</p>
          <a mat-flat-button color="primary" routerLink="/dashboard/wallet">Back to wallet</a>
        } @else if (state() === 'failed') {
          <mat-icon class="bad">error</mat-icon>
          <h2>Payment did not go through</h2>
          <p class="muted">{{ detail() }}</p>
          <div class="row">
            <a mat-flat-button color="primary" routerLink="/dashboard/wallet/deposit">Try again</a>
            <a mat-button routerLink="/dashboard/wallet">Back to wallet</a>
          </div>
        } @else {
          <mat-icon class="bad">link_off</mat-icon>
          <h2>Missing deposit reference</h2>
          <p class="muted">Open this page from the deposit flow so we know which payment to check.</p>
          <a mat-flat-button color="primary" routerLink="/dashboard/wallet/deposit">Start a deposit</a>
        }
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .result-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .result-card { padding: 2em 1.5em; display: flex; flex-direction: column; gap: 0.75em; align-items: center; text-align: center; max-width: 560px; }
    .result-card h2 { margin: 0; }
    .result-card mat-icon { font-size: 48px; height: 48px; width: 48px; }
    .result-card .ok { color: var(--ms-success); }
    .result-card .bad { color: var(--ms-error); }
    .muted { color: var(--ms-text-muted); }
    .row { display: flex; gap: 0.5em; flex-wrap: wrap; justify-content: center; }
    a[mat-flat-button], a[mat-button] { min-height: 44px; }
  `],
})
export class WalletDepositResultDesktopComponent implements OnInit {
  private readonly facade = inject(WalletDepositResultFacade);

  ngOnInit(): void {
    this.facade.ensureLoaded();
  }

  protected readonly state = this.facade.state;
  protected readonly amount = this.facade.amount;
  protected readonly reference = this.facade.reference;
  protected readonly detail = this.facade.detail;
}
