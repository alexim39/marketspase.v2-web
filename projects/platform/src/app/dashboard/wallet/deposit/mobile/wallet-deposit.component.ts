import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MobileCardComponent } from '@marketspase/shared/ui/mobile-card/mobile-card.component';
import { MobilePageShellComponent } from '@marketspase/shared/ui/mobile-page-shell/mobile-page-shell.component';
import { MobileStickyActionComponent } from '@marketspase/shared/ui/mobile-sticky-action/mobile-sticky-action.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { WalletDepositFacade } from '../state/wallet-deposit.facade';

@Component({
  selector: 'async-wallet-deposit-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MobileCardComponent,
    MobilePageShellComponent,
    MobileStickyActionComponent,
    PageSkeletonComponent,
  ],
  template: `
    <async-mobile-page-shell
      eyebrow="Wallet · Top up"
      title="Deposit funds"
      backLink="/dashboard/wallet"
      backLabel="Back to wallet"
    >
      <div class="trust-strip" aria-label="Deposit assurances">
        <span><mat-icon aria-hidden="true">bolt</mat-icon> Instant credit</span>
        <span><mat-icon aria-hidden="true">lock</mat-icon> Secure checkout</span>
        <span><mat-icon aria-hidden="true">receipt_long</mat-icon> Receipt</span>
      </div>

      @if (vm.loadingMethods()) {
        <async-page-skeleton layout="form" [rows]="4" label="deposit methods" [showHeader]="false" />
      } @else {
        <section class="step">
          <div class="step-head"><span class="step-number">1</span><div><h2>Payment method</h2><p>Pick the easiest option for you.</p></div></div>
          <div class="methods" role="group" aria-label="Deposit method">
            @for (m of vm.methods(); track m.id) {
              <button
                type="button"
                class="method-card"
                [class.active]="vm.method() === m.id"
                [attr.aria-pressed]="vm.method() === m.id"
                [disabled]="!m.enabled"
                (click)="vm.method.set(m.id)"
              >
                <span class="method-icon"><mat-icon>{{ vm.methodIcon(m.id) }}</mat-icon></span>
                <span class="method-copy"><strong>{{ m.label }}</strong><small>{{ m.detail || 'Secure checkout' }}</small></span>
                @if (vm.method() === m.id) {
                  <mat-icon class="method-check" aria-hidden="true">check_circle</mat-icon>
                }
              </button>
            }
          </div>
          @if (vm.selectedDisabled()) {
            <p class="error" role="alert">This method is unavailable right now — choose another.</p>
          }
        </section>

        <section class="step">
          <div class="step-head"><span class="step-number">2</span><div><h2>How much?</h2><p>Choose a quick amount or enter your own.</p></div></div>
          <div class="presets" role="group" aria-label="Quick amounts">
            @for (p of vm.presets; track p) {
              <button type="button" [class.active]="vm.amount() === p" [attr.aria-pressed]="vm.amount() === p" (click)="vm.amount.set(p)">
                ₦{{ p | number }}
              </button>
            }
          </div>
          <mat-form-field appearance="outline">
            <mat-label>Custom amount (₦)</mat-label>
            <input matInput type="number" inputmode="numeric" [value]="vm.amount()" (input)="vm.amount.set($any($event.target).valueAsNumber)" [min]="vm.min" [max]="vm.max" step="100" />
            <mat-hint>Between ₦{{ vm.min | number }} and ₦{{ vm.max | number }}</mat-hint>
          </mat-form-field>
          @if (vm.formError(); as ferr) {
            <p class="error" role="alert">{{ ferr }}</p>
          }
          @if (vm.error(); as err) {
            <p class="error" role="alert">{{ err }}</p>
          }
        </section>

        <async-mobile-card class="summary">
          <div class="summary-head"><mat-icon aria-hidden="true">wallet</mat-icon><span>Deposit summary</span></div>
          <strong class="summary-amount">₦{{ (vm.amount() || 0) | number }}</strong>
          <div class="summary-row"><span>Method</span><strong>{{ vm.methodLabel() }}</strong></div>
          <div class="summary-row"><span>Platform fee</span><strong>₦0</strong></div>
          <div class="summary-row total"><span>Wallet credit</span><strong>₦{{ (vm.amount() || 0) | number }}</strong></div>
          <p class="summary-note">You’ll leave MarketSpase for the provider’s secure checkout and return automatically after paying.</p>
        </async-mobile-card>
      }
      <div mobileFooter>
        <async-mobile-sticky-action ariaLabel="Continue to payment" [aboveBottomNav]="true">
          @if (vm.starting()) {
            <mat-progress-bar mode="indeterminate" aria-label="Opening checkout" />
          }
          <button
            mat-flat-button
            color="primary"
            type="button"
            class="continue"
            (click)="vm.start()"
            [disabled]="!vm.valid() || vm.starting() || vm.selectedDisabled()"
          >
            <mat-icon>lock</mat-icon>
            {{ vm.starting() ? 'Opening checkout…' : 'Continue to ' + vm.methodLabel() }}
          </button>
        </async-mobile-sticky-action>
      </div>
    </async-mobile-page-shell>
  `,
  styles: [`
    .trust-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
      color: var(--ms-text-muted);
      font-size: 0.72rem;
    }

    .trust-strip span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .trust-strip mat-icon {
      color: var(--ms-success);
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .step {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 18px;
    }

    .step-head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .step-number {
      display: inline-grid;
      width: 30px;
      height: 30px;
      flex: none;
      place-items: center;
      border-radius: 50%;
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
      font-size: 0.76rem;
      font-weight: 800;
    }

    .step-head h2 {
      margin: 0;
      font-size: 0.95rem;
    }

    .step-head p {
      margin: 2px 0 0;
      color: var(--ms-text-muted);
      font-size: 0.76rem;
      line-height: 1.45;
    }

    .methods {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .method-card {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 64px;
      padding: 12px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: var(--ms-surface);
      color: var(--ms-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .method-card.active {
      border-color: var(--ms-primary);
      background: var(--ms-primary-soft);
    }

    .method-card:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .method-icon {
      display: inline-grid;
      width: 36px;
      height: 36px;
      flex: none;
      place-items: center;
      border-radius: var(--ms-radius-md);
      background: var(--ms-canvas);
      color: var(--ms-primary-strong);
    }

    .method-copy {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .method-copy strong {
      font-size: 0.84rem;
    }

    .method-copy small {
      color: var(--ms-text-muted);
      font-size: 0.72rem;
      line-height: 1.4;
    }

    .method-check {
      flex: none;
      color: var(--ms-primary-strong);
    }

    .presets {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .presets button {
      min-height: 46px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: var(--ms-surface);
      color: var(--ms-text);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 650;
      cursor: pointer;
    }

    .presets button.active {
      border-color: var(--ms-primary);
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .summary-head {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--ms-text-muted);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .summary-head mat-icon {
      color: var(--ms-primary-strong);
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    .summary-amount {
      font-family: var(--ms-font-display);
      font-size: 2rem;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.03em;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--ms-text-muted);
      font-size: 0.78rem;
    }

    .summary-row strong {
      color: var(--ms-text);
    }

    .summary-row.total {
      padding-top: 8px;
      border-top: 1px dashed var(--ms-line);
    }

    .summary-note {
      margin: 2px 0 0;
      color: var(--ms-text-muted);
      font-size: 0.7rem;
      line-height: 1.45;
    }

    .error {
      margin: 0;
      color: var(--ms-error);
      font-size: 0.78rem;
    }

    .continue {
      width: 100%;
      min-height: 48px;
    }

    .continue mat-icon {
      margin-right: 6px;
    }
  `],
})
export class WalletDepositMobileComponent implements OnInit {
  protected readonly vm = inject(WalletDepositFacade);

  ngOnInit(): void {
    this.vm.ensureLoaded();
  }
}
