import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { switchMap, take, takeWhile, timer } from 'rxjs';
import { WalletService } from '../../../core/wallet/wallet.service';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * @title Deposit result — return landing from hosted checkout.
 *
 * Polls the owner-scoped intent (live provider cross-check while pending,
 * every 5s up to ~2 minutes). Success and failure are both terminal UI;
 * the credit itself happens server-side on the verified callback.
 */
@Component({
  selector: 'async-wallet-deposit-result',
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
export class WalletDepositResultComponent implements OnInit {
  private readonly wallet = inject(WalletService);
  private readonly routes = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<'checking' | 'success' | 'failed' | 'missing'>('missing');
  protected readonly amount = signal(0);
  protected readonly reference = signal('');
  protected readonly detail = signal('');

  ngOnInit(): void {
    const ref = this.routes.snapshot.queryParamMap.get('reference')
      ?? this.routes.snapshot.queryParamMap.get('trxref')
      ?? '';
    if (!ref) {
      this.state.set('missing');
      return;
    }
    this.reference.set(ref);
    this.state.set('checking');
    // Poll to ~2 minutes: callbacks usually land within seconds of return.
    timer(0, 5000)
      .pipe(
        take(25),
        switchMap(() => this.wallet.depositStatus(ref)),
        takeWhile((res) => {
          const s = String(res.data?.status ?? '').toLowerCase();
          if (s === 'success') {
            this.amount.set(Number(res.data?.amountNgn) || 0);
            this.state.set('success');
            return false;
          }
          const live = String(res.data?.liveStatus ?? '').toUpperCase();
          if (['FAIL', 'CLOSE', 'FAILED', 'ABANDONED', 'REVERSED'].includes(live) || s === 'failed') {
            this.detail.set('The payment provider reports this payment did not complete — no money moved.');
            this.state.set('failed');
            return false;
          }
          return true;
        }, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (err: ApiError) => {
          this.detail.set(userError(err));
          this.state.set('failed');
        },
        complete: () => {
          if (this.state() === 'checking') {
            this.detail.set('Still confirming — your wallet updates the moment the payment provider confirms. Check history shortly.');
            this.state.set('failed');
          }
        },
      });
  }
}
