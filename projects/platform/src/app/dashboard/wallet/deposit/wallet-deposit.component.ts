import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { Observable } from 'rxjs';
import { DepositMethod, WalletService } from '../../../core/wallet/wallet.service';
import { ApiError, userError } from '../../../core/http/api-error';

const PRESETS = [1000, 2500, 5000, 10000, 25000];
const MIN_NGN = 100;
const MAX_NGN = 1000000;

/**
 * @title Deposit funds — method switcher.
 *
 * The page renders whatever `GET deposit/methods` lists, so a future
 * gateway (Paystack…) needs only a backend registry entry plus one
 * section here — no redesign. Paystack/Opay = instant checkout handoff; bank
 * transfer = pay-first manual claim confirmed by an admin.
 */
@Component({
  selector: 'async-wallet-deposit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/wallet">Wallet</a> &gt;
        <span>Deposit</span>
      </div>
    </section>

    <section class="deposit-page">
      <div class="page-head">
        <div>
          <h2>Deposit funds</h2>
          <p class="subtitle">Card, bank transfer or USSD — pick the payment method that suits you.</p>
        </div>
      </div>

      @if (loadingMethods()) {
        <async-page-skeleton layout="form" [rows]="4" label="deposit methods" [showHeader]="false" />
      }
      <div class="methods" role="group" aria-label="Deposit method">
        @for (m of methods(); track m.id) {
          <button mat-button [class.active]="method() === m.id" [attr.aria-pressed]="method() === m.id" [disabled]="!m.enabled" (click)="method.set(m.id)">{{ m.label }}</button>
        }
      </div>
      @if (methodDetail(); as detail) {
        <p class="muted">{{ detail }}</p>
      }
      @if (selectedDisabled()) {
        <p class="error" role="alert">This payment method is unavailable right now — choose another.</p>
      }

      <div class="dp-card deposit-card">
        <h3>How much?</h3>
        <div class="presets" role="group" aria-label="Quick amounts">
          @for (p of presets; track p) {
            <button mat-button [class.active]="amount() === p" [attr.aria-pressed]="amount() === p" (click)="amount.set(p)">₦{{ p | number }}</button>
          }
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Custom amount (₦)</mat-label>
          <input matInput type="number" [value]="amount()" (input)="amount.set($any($event.target).valueAsNumber)" [min]="min" [max]="max" step="100" />
          <mat-hint>Between ₦{{ min | number }} and ₦{{ max | number }}</mat-hint>
        </mat-form-field>
        @if (formError(); as ferr) {
          <p class="error" role="alert">{{ ferr }}</p>
        }
        @if (error(); as err) {
          <p class="error" role="alert">
            {{ err }}
          </p>
        }
        @if (starting()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading" />
        }
        <button mat-flat-button color="primary" (click)="start()" [disabled]="!valid() || starting() || selectedDisabled()">
          {{ starting() ? 'Opening checkout…' : 'Pay ' + ((amount() || 0) | number) + ' with ' + methodLabel() }}
        </button>
        <p class="muted">You leave MarketSpase for the provider's secure checkout and return automatically after paying.</p>
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .deposit-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .deposit-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; max-width: 560px; }
    .deposit-card h3 { margin: 0; }
    .presets { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .presets button { min-height: 44px; }
    .presets button.active { border: 1px solid var(--ms-primary); font-weight: 700; }
    .methods { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .methods button { min-height: 44px; }
    .methods button.active { border: 1px solid var(--ms-primary); font-weight: 700; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); }
    button { min-height: 44px; }
  `],
})
export class WalletDepositComponent implements OnInit {
  private readonly wallet = inject(WalletService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly presets = PRESETS;
  protected readonly min = MIN_NGN;
  protected readonly max = MAX_NGN;
  protected readonly amount = signal<number>(2500);
  protected readonly starting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly methods = signal<DepositMethod[]>([]);
  protected readonly method = signal<string>('paystack');
  protected readonly loadingMethods = signal(true);

  ngOnInit(): void {
    this.wallet
      .depositMethods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = (res.data ?? []).filter((m) => m && m.id);
          this.methods.set(list);
          // Default to the first enabled method (Paystack leads the registry).
          const first = list.find((m) => m.enabled) ?? list[0];
          if (first) this.method.set(first.id);
          this.loadingMethods.set(false);
        },
        error: () => {
          // Registry unreachable — keep the primary card checkout visible.
          this.methods.set([{ id: 'paystack', kind: 'gateway', label: 'Card or bank payment', detail: '', enabled: true }]);
          this.method.set('paystack');
          this.loadingMethods.set(false);
        },
      });
  }

  protected selectedDisabled(): boolean {
    const selected = this.methods().find((m) => m.id === this.method());
    return !!selected && !selected.enabled;
  }

  protected methodDetail(): string | null {
    return this.methods().find((m) => m.id === this.method())?.detail ?? null;
  }

  protected methodLabel(): string {
    return this.methods().find((m) => m.id === this.method())?.label ?? 'Pay';
  }

  protected valid(): boolean {
    const a = Number(this.amount());
    return Number.isFinite(a) && a >= MIN_NGN && a <= MAX_NGN;
  }

  protected formError(): string | null {
    const a = Number(this.amount());
    if (!Number.isFinite(a)) return 'Enter an amount.';
    if (a < MIN_NGN) return `Minimum deposit is ₦${MIN_NGN.toLocaleString()}.`;
    if (a > MAX_NGN) return `Maximum deposit is ₦${MAX_NGN.toLocaleString()}.`;
    return null;
  }

  protected start(): void {
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
