import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { WalletDepositFacade } from '../state/wallet-deposit.facade';

@Component({
  selector: 'async-wallet-deposit-desktop',
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
      <header class="page-head">
        <div>
          <p class="eyebrow">Wallet · Top up</p>
          <h1>Deposit funds</h1>
          <p class="subtitle">Choose a payment method, set the amount and continue to a secure checkout. Your wallet updates as soon as the provider confirms.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/wallet"><mat-icon>arrow_back</mat-icon> Wallet</a>
      </header>

      <div class="trust-row" aria-label="Deposit assurances">
        <span><mat-icon>bolt</mat-icon> Instant wallet credit</span>
        <span><mat-icon>lock</mat-icon> Secure provider checkout</span>
        <span><mat-icon>receipt_long</mat-icon> Receipt after payment</span>
      </div>

      @if (loadingMethods()) {
        <async-page-skeleton layout="form" [rows]="4" label="deposit methods" [showHeader]="false" />
      }

      <div class="deposit-layout">
        <div class="deposit-card">
          <section class="step-block">
            <div class="step-head">
              <span class="step-number">1</span>
              <div><h2>Choose a payment method</h2><p>Pick the option that is easiest for you.</p></div>
            </div>
            <div class="methods" role="group" aria-label="Deposit method">
              @for (m of methods(); track m.id) {
                <button
                  type="button"
                  class="method-card"
                  [class.active]="method() === m.id"
                  [attr.aria-pressed]="method() === m.id"
                  [disabled]="!m.enabled"
                  (click)="method.set(m.id)">
                  <span class="method-icon"><mat-icon>{{ methodIcon(m.id) }}</mat-icon></span>
                  <span class="method-copy">
                    <strong>{{ m.label }}</strong>
                    <small>{{ m.detail || 'Secure checkout' }}</small>
                  </span>
                  @if (method() === m.id) {
                    <mat-icon class="method-check">check_circle</mat-icon>
                  }
                </button>
              }
            </div>
            @if (selectedDisabled()) {
              <p class="error" role="alert">This payment method is unavailable right now — choose another.</p>
            }
          </section>

          <section class="step-block">
            <div class="step-head">
              <span class="step-number">2</span>
              <div><h2>How much?</h2><p>Choose a quick amount or enter your own.</p></div>
            </div>
            <div class="presets" role="group" aria-label="Quick amounts">
              @for (p of presets; track p) {
                <button type="button" [class.active]="amount() === p" [attr.aria-pressed]="amount() === p" (click)="amount.set(p)">
                  ₦{{ p | number }}
                </button>
              }
            </div>
            <mat-form-field appearance="outline" class="amount-field">
              <mat-label>Custom amount (₦)</mat-label>
              <input matInput type="number" [value]="amount()" (input)="amount.set($any($event.target).valueAsNumber)" [min]="min" [max]="max" step="100" />
              <mat-icon matPrefix>payments</mat-icon>
              <mat-hint>Between ₦{{ min | number }} and ₦{{ max | number }}</mat-hint>
            </mat-form-field>
            @if (formError(); as ferr) {
              <p class="error" role="alert">{{ ferr }}</p>
            }
            @if (error(); as err) {
              <p class="error" role="alert">{{ err }}</p>
            }
          </section>
        </div>

        <aside class="summary-card">
          <div class="summary-head">
            <span class="summary-icon"><mat-icon>wallet</mat-icon></span>
            <div><span class="summary-eyebrow">Deposit summary</span><h2>You’re adding</h2></div>
          </div>
          <strong class="summary-amount">₦{{ (amount() || 0) | number }}</strong>
          <div class="summary-rows">
            <div><span>Method</span><strong>{{ methodLabel() }}</strong></div>
            <div><span>Platform fee</span><strong>₦0</strong></div>
            <div class="total"><span>Wallet credit</span><strong>₦{{ (amount() || 0) | number }}</strong></div>
          </div>
          @if (starting()) {
            <mat-progress-bar mode="indeterminate" aria-label="Opening checkout" />
          }
          <button mat-flat-button color="primary" class="pay-btn" (click)="start()" [disabled]="!valid() || starting() || selectedDisabled()">
            <mat-icon>lock</mat-icon>
            {{ starting() ? 'Opening checkout…' : 'Continue to ' + methodLabel() }}
          </button>
          <p class="summary-note">You’ll leave MarketSpase for the provider’s secure checkout and return automatically after paying.</p>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .deposit-page { display: flex; flex-direction: column; gap: 24px; max-width: 1120px; margin: 0 auto; padding-bottom: 32px; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 0; max-width: 58em; color: var(--ms-text-muted); line-height: 1.6; }
    .trust-row { display: flex; flex-wrap: wrap; gap: 16px; color: var(--ms-text-muted); font-size: 0.875rem; }
    .trust-row span { display: inline-flex; align-items: center; gap: 8px; }
    .trust-row mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--ms-success); }
    .deposit-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.55fr); gap: 24px; align-items: start; }
    .deposit-card, .summary-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); }
    .deposit-card { padding: 24px; display: grid; gap: 32px; }
    .step-block { display: grid; gap: 16px; }
    .step-head { display: flex; gap: 16px; align-items: flex-start; }
    .step-number { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.8125rem; font-weight: 700; }
    .step-head h2 { margin: 0 0 4px; font-size: 1.125rem; }
    .step-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.5; }
    .methods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .method-card { display: flex; align-items: center; gap: 12px; width: 100%; padding: 16px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text); text-align: left; cursor: pointer; transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease; }
    .method-card:hover:not(:disabled) { border-color: var(--ms-primary); box-shadow: var(--ms-shadow-sm); }
    .method-card.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); }
    .method-card:disabled { opacity: 0.5; cursor: not-allowed; }
    .method-icon { flex: none; width: 40px; height: 40px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-canvas); color: var(--ms-primary-strong); }
    .method-card.active .method-icon { background: var(--ms-surface); }
    .method-icon mat-icon { font-size: 21px; width: 21px; height: 21px; }
    .method-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .method-copy strong { font-size: 0.9375rem; font-weight: 600; }
    .method-copy small { color: var(--ms-text-muted); font-size: 0.8125rem; line-height: 1.4; }
    .method-check { color: var(--ms-primary-strong); flex: none; }
    .presets { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
    .presets button { min-height: 48px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); color: var(--ms-text); font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: border-color 160ms ease, background 160ms ease; }
    .presets button:hover { border-color: var(--ms-primary); }
    .presets button.active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .amount-field { width: 100%; }
    .error { margin: 0; color: var(--ms-error); font-size: 0.875rem; }
    .summary-card { position: sticky; top: 96px; padding: 24px; display: grid; gap: 16px; }
    .summary-head { display: flex; align-items: center; gap: 12px; }
    .summary-icon { width: 44px; height: 44px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-eyebrow { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .summary-head h2 { margin: 2px 0 0; font-size: 1.0625rem; }
    .summary-amount { font-family: var(--ms-font-display); font-size: clamp(2rem, 3vw, 2.75rem); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
    .summary-rows { display: grid; gap: 4px; border-top: 1px solid var(--ms-line); border-bottom: 1px solid var(--ms-line); padding: 12px 0; }
    .summary-rows div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; color: var(--ms-text-muted); font-size: 0.875rem; }
    .summary-rows strong { color: var(--ms-text); font-weight: 600; text-align: right; }
    .summary-rows .total { border-top: 1px dashed var(--ms-line); margin-top: 4px; padding-top: 12px; }
    .summary-rows .total strong { font-size: 1.125rem; }
    .pay-btn { width: 100%; min-height: 48px; font-weight: 600; }
    .pay-btn mat-icon { margin-right: 6px; }
    .summary-note { margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; text-align: center; }
    @media (max-width: 900px) {
      .deposit-layout { grid-template-columns: minmax(0, 1fr); }
      .summary-card { position: static; }
    }
    @media (max-width: 640px) {
      .deposit-card, .summary-card { padding: 16px; }
      .methods { grid-template-columns: minmax(0, 1fr); }
      .presets { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
})
export class WalletDepositDesktopComponent implements OnInit {
  private readonly facade = inject(WalletDepositFacade);

  ngOnInit(): void {
    this.facade.ensureLoaded();
  }

  protected readonly presets = this.facade.presets;
  protected readonly min = this.facade.min;
  protected readonly max = this.facade.max;
  protected readonly amount = this.facade.amount;
  protected readonly starting = this.facade.starting;
  protected readonly error = this.facade.error;
  protected readonly methods = this.facade.methods;
  protected readonly method = this.facade.method;
  protected readonly loadingMethods = this.facade.loadingMethods;

  protected selectedDisabled(): boolean {
    return this.facade.selectedDisabled();
  }

  protected methodDetail(): string | null {
    return this.facade.methodDetail();
  }

  protected methodLabel(): string {
    return this.facade.methodLabel();
  }

  protected methodIcon(id: string): string {
    return this.facade.methodIcon(id);
  }

  protected valid(): boolean {
    return this.facade.valid();
  }

  protected formError(): string | null {
    return this.facade.formError();
  }

  protected start(): void {
    this.facade.start();
  }
}
