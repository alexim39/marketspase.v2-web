import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { DepositMethod, WalletService } from '../../../../core/wallet/wallet.service';
import { ApiError, userError } from '../../../../core/http/api-error';

const PRESETS = [1000, 2500, 5000, 10000, 25000];
const MIN_NGN = 100;
const MAX_NGN = 1000000;

/** Shared deposit methods, amount and checkout handoff. */
@Injectable()
export class WalletDepositFacade {
  private readonly wallet = inject(WalletService);
  private readonly destroyRef = inject(DestroyRef);

  readonly presets = PRESETS;
  readonly min = MIN_NGN;
  readonly max = MAX_NGN;
  readonly amount = signal<number>(2500);
  readonly starting = signal(false);
  readonly error = signal<string | null>(null);
  readonly methods = signal<DepositMethod[]>([]);
  readonly method = signal<string>('paystack');
  readonly loadingMethods = signal(true);
  private started = false;

  ensureLoaded(): void {
    if (this.started) return;
    this.started = true;
    this.wallet
      .depositMethods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = (res.data ?? []).filter((m) => m && m.id);
          this.methods.set(list);
          const first = list.find((m) => m.enabled) ?? list[0];
          if (first) this.method.set(first.id);
          this.loadingMethods.set(false);
        },
        error: () => {
          this.methods.set([{ id: 'paystack', kind: 'gateway', label: 'Card or bank payment', detail: '', enabled: true }]);
          this.method.set('paystack');
          this.loadingMethods.set(false);
        },
      });
  }

  selectedDisabled(): boolean {
    const selected = this.methods().find((m) => m.id === this.method());
    return !!selected && !selected.enabled;
  }

  methodDetail(): string | null {
    return this.methods().find((m) => m.id === this.method())?.detail ?? null;
  }

  methodLabel(): string {
    return this.methods().find((m) => m.id === this.method())?.label ?? 'Pay';
  }

  methodIcon(id: string): string {
    const key = String(id ?? '').toLowerCase();
    if (key.includes('paystack') || key.includes('card')) return 'credit_card';
    if (key.includes('opay') || key.includes('wallet')) return 'account_balance_wallet';
    if (key.includes('bank') || key.includes('transfer')) return 'account_balance';
    if (key.includes('ussd')) return 'dialpad';
    return 'payments';
  }

  valid(): boolean {
    const a = Number(this.amount());
    return Number.isFinite(a) && a >= MIN_NGN && a <= MAX_NGN;
  }

  formError(): string | null {
    const a = Number(this.amount());
    if (!Number.isFinite(a)) return 'Enter an amount.';
    if (a < MIN_NGN) return `Minimum deposit is ₦${MIN_NGN.toLocaleString()}.`;
    if (a > MAX_NGN) return `Maximum deposit is ₦${MAX_NGN.toLocaleString()}.`;
    return null;
  }

  start(): void {
    if (!this.valid() || this.starting() || this.selectedDisabled()) return;
    this.starting.set(true);
    this.error.set(null);
    const request: Observable<{ data: { checkoutUrl?: string; cashierUrl?: string } }> = this.method() === 'paystack'
      ? this.wallet.initPaystackDeposit(Number(this.amount()))
      : this.wallet.initDeposit(Number(this.amount()));
    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const url = res.data?.checkoutUrl ?? res.data?.cashierUrl;
          if (!url) {
            this.starting.set(false);
            this.error.set('Checkout did not open — try again.');
            return;
          }
          window.location.href = url;
        },
        error: (err: ApiError) => {
          this.starting.set(false);
          this.error.set(userError(err));
        },
      });
  }
}
