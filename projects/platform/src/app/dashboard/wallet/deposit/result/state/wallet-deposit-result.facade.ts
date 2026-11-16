import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap, take, takeWhile, timer } from 'rxjs';
import { WalletService } from '../../../../../core/wallet/wallet.service';
import { ApiError, userError } from '../../../../../core/http/api-error';

/** Shared deposit-return polling state. */
@Injectable()
export class WalletDepositResultFacade {
  private readonly wallet = inject(WalletService);
  private readonly routes = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<'checking' | 'success' | 'failed' | 'missing'>('missing');
  readonly amount = signal(0);
  readonly reference = signal('');
  readonly detail = signal('');
  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;

    const ref = this.routes.snapshot.queryParamMap.get('reference')
      ?? this.routes.snapshot.queryParamMap.get('trxref')
      ?? '';
    if (!ref) {
      this.state.set('missing');
      return;
    }
    this.reference.set(ref);
    this.state.set('checking');
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
