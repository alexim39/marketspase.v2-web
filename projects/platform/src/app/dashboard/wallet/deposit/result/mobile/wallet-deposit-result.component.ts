import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { MobileCardComponent } from '@marketspase/shared/ui/mobile-card/mobile-card.component';
import { MobilePageShellComponent } from '@marketspase/shared/ui/mobile-page-shell/mobile-page-shell.component';
import { WalletDepositResultFacade } from '../state/wallet-deposit-result.facade';

@Component({
  selector: 'async-wallet-deposit-result-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule, MobileCardComponent, MobilePageShellComponent, RouterModule],
  template: `
    <async-mobile-page-shell
      eyebrow="Wallet · Payment"
      title="Deposit result"
      backLink="/dashboard/wallet"
      backLabel="Back to wallet"
    >
      <async-mobile-card class="result-card">
        @if (vm.state() === 'checking') {
          <mat-progress-bar mode="indeterminate" aria-label="Confirming payment" />
          <div class="status-icon is-checking"><mat-icon aria-hidden="true">hourglass_top</mat-icon></div>
          <h2>Confirming your payment…</h2>
          <p>Asking the payment provider directly — this can take a few seconds after you pay.</p>
        } @else if (vm.state() === 'success') {
          <div class="status-icon is-success"><mat-icon aria-hidden="true">check_circle</mat-icon></div>
          <h2>₦{{ vm.amount() | number }} added</h2>
          <p>Reference {{ vm.reference() }}</p>
          <a mat-flat-button color="primary" routerLink="/dashboard/wallet">Back to wallet</a>
        } @else if (vm.state() === 'failed') {
          <div class="status-icon is-error"><mat-icon aria-hidden="true">error</mat-icon></div>
          <h2>Payment did not go through</h2>
          <p>{{ vm.detail() }}</p>
          <div class="actions">
            <a mat-flat-button color="primary" routerLink="/dashboard/wallet/deposit">Try again</a>
            <a mat-stroked-button routerLink="/dashboard/wallet">Back to wallet</a>
          </div>
        } @else {
          <div class="status-icon is-error"><mat-icon aria-hidden="true">link_off</mat-icon></div>
          <h2>Missing deposit reference</h2>
          <p>Open this page from the deposit flow so we know which payment to check.</p>
          <a mat-flat-button color="primary" routerLink="/dashboard/wallet/deposit">Start a deposit</a>
        }
      </async-mobile-card>
    </async-mobile-page-shell>
  `,
  styles: [`
    .result-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 26px 18px;
      text-align: center;
    }

    .status-icon {
      display: inline-grid;
      width: 68px;
      height: 68px;
      place-items: center;
      margin: 6px 0;
      border-radius: 50%;
      background: var(--ms-surface-3);
      color: var(--ms-text-muted);
    }

    .status-icon.is-checking {
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .status-icon.is-success {
      background: var(--ms-success-soft);
      color: var(--ms-success);
    }

    .status-icon.is-error {
      background: var(--ms-error-soft);
      color: var(--ms-error);
    }

    .status-icon mat-icon {
      width: 34px;
      height: 34px;
      font-size: 34px;
    }

    h2 {
      margin: 0;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }

    p {
      margin: 0 0 8px;
      color: var(--ms-text-muted);
      font-size: 0.82rem;
      line-height: 1.5;
    }

    a {
      min-height: 46px;
      width: 100%;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }
  `],
})
export class WalletDepositResultMobileComponent implements OnInit {
  protected readonly vm = inject(WalletDepositResultFacade);

  ngOnInit(): void {
    this.vm.ensureLoaded();
  }
}
