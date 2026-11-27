import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, finalize, switchMap } from 'rxjs/operators';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PartnerInterface } from '../../../_common/services/partner.service';
import { formatMoney } from '../../../core/format/money';
import { userError } from '../../../core/http/api-error';
import { UiFeedbackService } from '../../../core/ui/ui-feedback.service';
import {
  BankOption,
  PaystackService,
  ResolvedAccount,
  SavedWithdrawalAccount,
} from './paystack.service';

/**
 * Modern withdrawal dialog.
 *
 * Saved destinations are selectable cards with explicit removal. A new
 * account uses the searchable bank autocomplete and a debounced Paystack name
 * lookup. The review step shows exactly where the money goes before the wallet
 * is debited; the server re-resolves the account before accepting the request.
 */
@Component({
  selector: 'async-biling-withdraw',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="withdraw-dialog">
      <header class="withdraw-head">
        <div>
          <p class="eyebrow">Wallet withdrawal</p>
          <h2 mat-dialog-title>Withdraw funds</h2>
          <p class="sub">Choose a saved account or add a new one. Payouts are verified automatically.</p>
        </div>
        <button mat-icon-button type="button" aria-label="Close withdrawal dialog" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <div class="balance-strip">
        <div class="balance-main">
          <span>Available to withdraw</span>
          <strong>{{ money(balance) }}</strong>
        </div>
        @if (bonusBalance > 0) {
          <p class="bonus-note">
            <mat-icon aria-hidden="true">info</mat-icon>
            <span>{{ money(bonusBalance) }} is platform bonus. It can be used for SMS, campaigns and other platform services but cannot be withdrawn.</span>
          </p>
        }
      </div>

      <mat-dialog-content class="withdraw-body">
        @if (!reviewing()) {
          <form [formGroup]="form" (ngSubmit)="review()" class="withdraw-grid" novalidate>
            <section class="destination-panel" aria-labelledby="destination-title">
              <div class="section-head">
                <div>
                  <p class="eyebrow">Destination</p>
                  <h3 id="destination-title">Where should we send it?</h3>
                </div>
                <span class="count-pill">{{ savedAccounts().length }}/{{ accountsMax() }} saved</span>
              </div>

              @if (savedAccounts().length > 0) {
                <div class="saved-list" role="radiogroup" aria-label="Saved payout accounts">
                  @for (account of savedAccounts(); track account.id) {
                    <div
                      class="saved-card"
                      [class.selected]="selectedSavedId() === account.id"
                      (click)="selectSaved(account)"
                      (keydown.enter)="selectSaved(account)"
                      (keydown.space)="selectSaved(account); $event.preventDefault()"
                      tabindex="0"
                      role="radio"
                      [attr.aria-checked]="selectedSavedId() === account.id">
                      <span class="bank-icon"><mat-icon>account_balance</mat-icon></span>
                      <div class="saved-copy">
                        <strong>{{ account.accountName }}</strong>
                        <span>{{ account.bankName }} · •••• {{ account.accountLast4 }}</span>
                      </div>
                      <mat-icon class="radio-mark" aria-hidden="true">
                        {{ selectedSavedId() === account.id ? 'check_circle' : 'radio_button_unchecked' }}
                      </mat-icon>
                      <button
                        mat-icon-button
                        type="button"
                        class="remove-btn"
                        [disabled]="deletingId() === account.id"
                        (click)="removeSaved(account, $event)"
                        [attr.aria-label]="'Remove ' + account.bankName + ' account ending ' + account.accountLast4">
                        <mat-icon>{{ deletingId() === account.id ? 'hourglass_top' : 'delete_outline' }}</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              }

              <div
                class="saved-card new-card"
                [class.selected]="!selectedSavedId()"
                (click)="useNewAccount()"
                (keydown.enter)="useNewAccount()"
                (keydown.space)="useNewAccount(); $event.preventDefault()"
                tabindex="0"
                role="radio"
                [attr.aria-checked]="!selectedSavedId()">
                <span class="bank-icon"><mat-icon>add</mat-icon></span>
                <div class="saved-copy">
                  <strong>Use a new account</strong>
                  <span>Enter a different bank account for this withdrawal</span>
                </div>
                <mat-icon class="radio-mark" aria-hidden="true">
                  {{ !selectedSavedId() ? 'check_circle' : 'radio_button_unchecked' }}
                </mat-icon>
              </div>

              @if (!selectedSavedId()) {
                <div class="account-form">
                  <mat-form-field appearance="outline">
                    <mat-label>Bank</mat-label>
                    <input
                      matInput
                      [value]="bankQuery()"
                      (input)="onBankQuery($any($event.target).value)"
                      [matAutocomplete]="bankAuto"
                      placeholder="Search your bank"
                      autocomplete="off"
                    />
                    <mat-autocomplete #bankAuto="matAutocomplete" (optionSelected)="selectBank($event.option.value)">
                      @for (bank of filteredBanks(); track bank.code + '|' + bank.name) {
                        <mat-option [value]="bank">{{ bank.name }}</mat-option>
                      }
                    </mat-autocomplete>
                    @if (bankTouched() && !selectedBank()) {
                      <mat-error>Choose the bank that holds the account.</mat-error>
                    }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Account number</mat-label>
                    <input
                      matInput
                      formControlName="accountNumber"
                      inputmode="numeric"
                      maxlength="10"
                      autocomplete="off"
                      (input)="onAccountInput($event)"
                    />
                    <mat-hint>10-digit NUBAN</mat-hint>
                    @if (form.controls['accountNumber'].touched && form.controls['accountNumber'].hasError('required')) {
                      <mat-error>Account number is required.</mat-error>
                    } @else if (form.controls['accountNumber'].touched && form.controls['accountNumber'].hasError('pattern')) {
                      <mat-error>Enter the 10-digit account number.</mat-error>
                    }
                  </mat-form-field>

                  @if (resolving()) {
                    <div class="lookup" role="status">
                      <mat-progress-bar mode="indeterminate" aria-label="Looking up account name" />
                      <span>Looking up the account name…</span>
                    </div>
                  }

                  @if (resolvedAccount(); as account) {
                    <div class="resolved" role="status">
                      <mat-icon aria-hidden="true">verified</mat-icon>
                      <div>
                        <strong>{{ account.accountName }}</strong>
                        <span>{{ selectedBank()?.name }} · {{ account.accountNumber }}</span>
                      </div>
                    </div>
                  }

                  @if (resolveError(); as lookupError) {
                    <p class="error" role="alert">{{ lookupError }}</p>
                  }

                  @if (resolvedAccount() && !isCurrentAccountSaved()) {
                    <div class="save-row">
                      <mat-slide-toggle
                        [checked]="saveAccount()"
                        [disabled]="atLimit()"
                        (change)="saveAccount.set($any($event).checked)">
                        Save this account for future withdrawals
                      </mat-slide-toggle>
                      <p class="toggle-hint">
                        @if (atLimit()) {
                          You have {{ accountsMax() }} saved accounts. Remove one to save a new one.
                        } @else if (saveAccount()) {
                          This account will be available next time.
                        } @else {
                          This account will not be saved.
                        }
                      </p>
                    </div>
                  } @else if (resolvedAccount()) {
                    <p class="saved-note">
                      <mat-icon aria-hidden="true">check_circle</mat-icon>
                      This account is already saved.
                    </p>
                  }
                </div>
              }
            </section>

            <aside class="amount-panel">
              <div class="amount-card">
                <div class="section-head">
                  <div>
                    <p class="eyebrow">Amount</p>
                    <h3>How much?</h3>
                  </div>
                  <span class="muted small">Min ₦100</span>
                </div>

                <mat-form-field appearance="outline" class="amount-field">
                  <mat-label>Amount</mat-label>
                  <span matTextPrefix>₦</span>
                  <input matInput type="number" formControlName="amount" [max]="balance" min="100" step="100" />
                  <mat-hint>{{ money(balance) }} available</mat-hint>
                  @if (form.controls['amount'].touched && form.controls['amount'].hasError('required')) {
                    <mat-error>Amount is required.</mat-error>
                  } @else if (form.controls['amount'].touched && form.controls['amount'].hasError('min')) {
                    <mat-error>The minimum withdrawal is ₦100.</mat-error>
                  } @else if (form.controls['amount'].touched && form.controls['amount'].hasError('max')) {
                    <mat-error>You cannot withdraw more than your available balance.</mat-error>
                  }
                </mat-form-field>

                <div class="quick-row" role="group" aria-label="Quick amounts">
                  <button type="button" (click)="setAmountPercent(0.25)">25%</button>
                  <button type="button" (click)="setAmountPercent(0.5)">50%</button>
                  <button type="button" (click)="setAmountPercent(1)">Max</button>
                </div>

                <dl class="summary">
                  <div><dt>Destination</dt><dd>{{ destinationLabel() }}</dd></div>
                  <div><dt>Fee</dt><dd>₦0</dd></div>
                  <div class="total"><dt>You receive</dt><dd>{{ money(amountValue()) }}</dd></div>
                </dl>

                @if (error(); as err) {
                  <p class="error" role="alert">{{ err }}</p>
                }

                <button mat-flat-button color="primary" type="submit" class="cta" [disabled]="!ready() || loading()">
                  Review withdrawal
                </button>
                <p class="secure-note">
                  <mat-icon aria-hidden="true">lock</mat-icon>
                  Secured by your account password and Paystack verification.
                </p>
              </div>
            </aside>
          </form>
        } @else {
          <div class="review-layout">
            <section class="review-card" aria-labelledby="review-title">
              <p class="eyebrow">Confirm</p>
              <h3 id="review-title">Review your withdrawal</h3>
              <dl class="review-list">
                <div><dt>Bank</dt><dd>{{ selectedBank()?.name }}</dd></div>
                <div><dt>Account</dt><dd>{{ resolvedAccount()?.accountName }}</dd></div>
                <div><dt>Number</dt><dd>{{ maskedAccount() }}</dd></div>
                <div class="total"><dt>Amount</dt><dd>{{ money(amountValue()) }}</dd></div>
              </dl>
              <p class="muted">
                Your wallet is debited now and the payout is sent automatically. If Paystack cannot complete it,
                the full amount is refunded.
              </p>

              <mat-form-field appearance="outline" class="confirm-password">
                <mat-label>Account password</mat-label>
                <input
                  matInput
                  [type]="showPassword() ? 'text' : 'password'"
                  [formControl]="passwordControl"
                  autocomplete="current-password"
                  maxlength="128"
                  (keydown.enter)="submit()"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-hint>Required to prove it is you before the wallet is debited.</mat-hint>
                @if (passwordControl.touched && passwordControl.hasError('required')) {
                  <mat-error>Enter your account password.</mat-error>
                }
              </mat-form-field>

              @if (error(); as err) {
                <p class="error" role="alert">{{ err }}</p>
              }

              <div class="review-actions">
                <button mat-stroked-button type="button" (click)="backToForm()" [disabled]="loading()">Back</button>
                <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="loading()">
                  {{ loading() ? 'Submitting…' : 'Confirm withdrawal' }}
                </button>
              </div>
            </section>
          </div>
        }
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    .withdraw-dialog { display: flex; flex-direction: column; max-height: 90vh; }
    .withdraw-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 24px 28px 12px; }
    .withdraw-head h2 { margin: 4px 0 4px; font-size: 1.45rem; letter-spacing: -0.02em; }
    .sub { margin: 0; color: var(--ms-text-muted); line-height: 1.5; max-width: 60ch; }
    .balance-strip { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 0 28px 16px; }
    .balance-main { display: flex; flex-direction: column; gap: 2px; }
    .balance-main span { color: var(--ms-text-muted); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .balance-main strong { font-size: 1.7rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .bonus-note { display: flex; align-items: flex-start; gap: 6px; margin: 0; max-width: 46ch; padding: 8px 10px; border-radius: 10px; background: var(--ms-warning-soft); color: var(--ms-warning); font-size: 0.75rem; line-height: 1.45; }
    .bonus-note mat-icon { flex: none; font-size: 16px; width: 16px; height: 16px; }
    .withdraw-body { padding: 0 28px 24px; overflow-y: auto; }
    .withdraw-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr); gap: 24px; align-items: start; }
    .destination-panel { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
    .section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .section-head h3 { margin: 4px 0 0; font-size: 1.05rem; }
    .count-pill { flex: none; padding: 4px 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; white-space: nowrap; }
    .saved-list { display: flex; flex-direction: column; gap: 10px; }
    .saved-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-surface); cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
    .saved-card:hover { border-color: var(--ms-primary); transform: translateY(-1px); }
    .saved-card.selected { border-color: var(--ms-primary); box-shadow: 0 0 0 3px var(--ms-primary-soft); background: color-mix(in srgb, var(--ms-primary-soft) 42%, var(--ms-surface)); }
    .bank-icon { flex: none; width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--ms-canvas); color: var(--ms-primary-strong); }
    .saved-card.selected .bank-icon { background: var(--ms-primary); color: #fff; }
    .saved-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .saved-copy strong { font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .saved-copy span { color: var(--ms-text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .radio-mark { flex: none; color: var(--ms-text-muted); }
    .saved-card.selected .radio-mark { color: var(--ms-primary); }
    .remove-btn { flex: none; color: var(--ms-text-muted); }
    .remove-btn:hover { color: var(--ms-error); }
    .new-card { border-style: dashed; }
    .new-card.selected { border-style: solid; }
    .account-form { display: grid; gap: 12px; margin-top: 4px; }
    .lookup { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--ms-line); border-radius: 10px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.8rem; }
    .resolved { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--ms-success) 28%, var(--ms-line)); border-radius: 10px; background: var(--ms-success-soft); color: var(--ms-success); }
    .resolved mat-icon { flex: none; }
    .resolved div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .resolved strong { font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .resolved span { font-size: 0.76rem; opacity: 0.9; }
    .save-row { display: grid; gap: 4px; padding: 12px 14px; border: 1px solid var(--ms-line); border-radius: 10px; background: var(--ms-canvas); }
    .toggle-hint { margin: 0; color: var(--ms-text-muted); font-size: 0.76rem; line-height: 1.4; }
    .saved-note { display: flex; align-items: center; gap: 6px; margin: 0; padding: 9px 12px; border-radius: 10px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.8rem; }
    .saved-note mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .amount-panel { min-width: 0; }
    .amount-card { display: flex; flex-direction: column; gap: 14px; padding: 20px; border: 1px solid var(--ms-line); border-radius: 16px; background: var(--ms-canvas); position: sticky; top: 0; }
    .amount-field { width: 100%; }
    .quick-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .quick-row button { border: 1px solid var(--ms-line); background: var(--ms-surface); border-radius: 999px; min-height: 36px; padding: 6px 10px; cursor: pointer; font: inherit; font-size: 0.8rem; font-weight: 600; color: var(--ms-text); transition: border-color 0.15s ease, background 0.15s ease; }
    .quick-row button:hover { border-color: var(--ms-primary); background: var(--ms-primary-soft); }
    .summary { margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .summary div { display: flex; justify-content: space-between; gap: 12px; font-size: 0.85rem; }
    .summary dt { color: var(--ms-text-muted); }
    .summary dd { margin: 0; text-align: right; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .summary .total { padding-top: 8px; border-top: 1px solid var(--ms-line); font-size: 1rem; }
    .cta { width: 100%; min-height: 48px; }
    .secure-note { display: flex; align-items: flex-start; gap: 6px; margin: 0; color: var(--ms-text-muted); font-size: 0.72rem; line-height: 1.4; }
    .secure-note mat-icon { flex: none; font-size: 15px; width: 15px; height: 15px; }
    .review-layout { display: flex; justify-content: center; padding: 8px 0; }
    .review-card { width: min(100%, 560px); display: flex; flex-direction: column; gap: 14px; }
    .review-card h3 { margin: 4px 0 0; }
    .review-list { margin: 0; display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-canvas); }
    .review-list div { display: flex; justify-content: space-between; gap: 16px; font-size: 0.9rem; }
    .review-list dt { color: var(--ms-text-muted); }
    .review-list dd { margin: 0; text-align: right; font-weight: 600; }
    .review-list .total { padding-top: 10px; border-top: 1px solid var(--ms-line); font-size: 1.05rem; }
    .review-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .confirm-password { width: 100%; }
    .error { margin: 0; color: var(--ms-error); font-size: 0.8rem; line-height: 1.45; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .muted { margin: 0; color: var(--ms-text-muted); font-size: 0.82rem; line-height: 1.5; }
    .small { font-size: 0.72rem; }
    @media (max-width: 900px) {
      .withdraw-dialog { max-height: none; }
      .withdraw-grid { grid-template-columns: minmax(0, 1fr); }
      .amount-card { position: static; }
    }
    @media (max-width: 600px) {
      .withdraw-head { padding: 20px 18px 10px; }
      .balance-strip { padding: 0 18px 14px; }
      .withdraw-body { padding: 0 18px 20px; }
      .saved-card { padding: 11px 12px; }
      .review-actions { flex-direction: column-reverse; }
      .review-actions button { width: 100%; }
    }
  `],
})
export class BillingWithdrawComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly paymentService = inject(PaystackService);
  private readonly ui = inject(UiFeedbackService);
  private readonly dialogRef = inject(MatDialogRef<BillingWithdrawComponent>);
  private readonly destroyRef = inject(DestroyRef);
  readonly partner = inject<PartnerInterface>(MAT_DIALOG_DATA);

  protected readonly balance = Math.max(0, Number(this.partner?.withdrawableBalance
    ?? (Number(this.partner?.balance ?? 0) - Number(this.partner?.bonusBalance ?? 0))));
  protected readonly bonusBalance = Math.max(0, Number(this.partner?.bonusBalance ?? 0));
  protected readonly form: FormGroup = this.fb.group({
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    amount: [null as number | null, [Validators.required, Validators.min(100), Validators.max(this.balance)]],
  });
  /** Step-up confirmation; kept outside the destination form so review stays valid. */
  protected readonly passwordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(128)],
  });
  protected readonly showPassword = signal(false);

  protected readonly banks = signal<BankOption[]>([]);
  protected readonly bankQuery = signal('');
  protected readonly selectedBank = signal<BankOption | null>(null);
  protected readonly bankTouched = signal(false);
  protected readonly resolvedAccount = signal<ResolvedAccount | null>(null);
  protected readonly resolving = signal(false);
  protected readonly resolveError = signal<string | null>(null);
  protected readonly reviewing = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly savedAccounts = signal<SavedWithdrawalAccount[]>([]);
  protected readonly accountsMax = signal(5);
  protected readonly selectedSavedId = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly saveAccount = signal(true);

  protected readonly selectedSaved = computed(() => {
    const id = this.selectedSavedId();
    return id ? this.savedAccounts().find((account) => account.id === id) ?? null : null;
  });
  protected readonly atLimit = computed(() => this.savedAccounts().length >= this.accountsMax());

  private readonly lookup$ = new Subject<void>();

  protected readonly filteredBanks = computed(() => {
    const q = this.bankQuery().trim().toLowerCase();
    const all = this.banks();
    const matches = q ? all.filter((bank) => bank.name.toLowerCase().includes(q)) : all;
    return matches.slice(0, 50);
  });

  ngOnInit(): void {
    this.paymentService.banks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (banks) => {
          this.banks.set(banks);
          this.loadSavedAccounts();
        },
        error: () => {
          this.banks.set([]);
          this.loadSavedAccounts();
          this.error.set('Could not load the bank list. Close and try again.');
        },
      });

    this.lookup$
      .pipe(
        debounceTime(350),
        switchMap(() => {
          const bank = this.selectedBank();
          const accountNumber = String(this.form.controls['accountNumber'].value ?? '');
          if (!bank || accountNumber.length !== 10) {
            this.resolvedAccount.set(null);
            this.resolving.set(false);
            return of(null);
          }
          this.resolving.set(true);
          this.resolveError.set(null);
          return this.paymentService.resolveAccount(accountNumber, bank.code).pipe(
            catchError((err) => {
              this.resolvedAccount.set(null);
              this.resolveError.set(userError(err));
              return of(null);
            }),
            finalize(() => this.resolving.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((account) => {
        if (account) {
          this.resolvedAccount.set(account);
          this.resolveError.set(null);
        }
      });
  }

  private loadSavedAccounts(preselect = true): void {
    this.paymentService.savedWithdrawalAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ accounts, max }) => {
          this.savedAccounts.set(Array.isArray(accounts) ? accounts : []);
          this.accountsMax.set(Math.max(1, Number(max) || 5));
          if (preselect && !this.selectedSavedId() && !this.form.dirty && this.savedAccounts().length > 0) {
            this.selectSaved(this.savedAccounts()[0]);
          }
          if (this.savedAccounts().length >= this.accountsMax()) {
            this.saveAccount.set(false);
          }
        },
        error: () => { /* saved accounts are optional; never block the form */ },
      });
  }

  protected selectSaved(account: SavedWithdrawalAccount): void {
    if (this.loading()) return;
    this.selectedSavedId.set(account.id);
    const bank = this.banks().find((item) => item.code === account.bankCode)
      ?? { code: account.bankCode, name: account.bankName };
    this.selectedBank.set(bank);
    this.bankQuery.set(bank.name);
    this.bankTouched.set(true);
    this.form.controls['accountNumber'].setValue(account.accountNumber);
    this.resolvedAccount.set({
      accountName: account.accountName,
      accountNumber: account.accountNumber,
    });
    this.resolveError.set(null);
    this.error.set(null);
    this.saveAccount.set(false);
  }

  protected useNewAccount(): void {
    if (this.loading()) return;
    this.selectedSavedId.set(null);
    this.selectedBank.set(null);
    this.bankQuery.set('');
    this.bankTouched.set(false);
    this.form.controls['accountNumber'].setValue('');
    this.resolvedAccount.set(null);
    this.resolveError.set(null);
    this.error.set(null);
    this.saveAccount.set(!this.atLimit());
  }

  protected async removeSaved(account: SavedWithdrawalAccount, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.deletingId()) return;
    const confirmed = await this.ui.confirm({
      title: 'Remove saved account?',
      message: `${account.bankName} •••• ${account.accountLast4} will be removed. You can add it again during a future withdrawal.`,
      confirmText: 'Remove account',
      tone: 'warning',
      icon: 'delete_outline',
    });
    if (!confirmed) return;

    this.deletingId.set(account.id);
    this.paymentService.deleteSavedWithdrawalAccount(account.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deletingId.set(null)),
      )
      .subscribe({
        next: () => {
          this.savedAccounts.update((rows) => rows.filter((row) => row.id !== account.id));
          if (this.selectedSavedId() === account.id) this.useNewAccount();
          this.saveAccount.set(!this.atLimit());
          this.ui.success('Saved account removed');
        },
        error: (err) => this.error.set(userError(err)),
      });
  }

  protected onBankQuery(value: string): void {
    this.bankQuery.set(value);
    this.bankTouched.set(true);
    if (this.selectedSavedId() && value !== this.selectedSaved()?.bankName) {
      this.detachSavedSelection();
    }
    if (this.selectedBank() && value !== this.selectedBank()?.name) {
      this.selectedBank.set(null);
      this.resolvedAccount.set(null);
    }
  }

  protected selectBank(bank: BankOption): void {
    this.selectedBank.set(bank);
    this.bankQuery.set(bank.name);
    this.bankTouched.set(true);
    if (this.selectedSavedId() && bank.code !== this.selectedSaved()?.bankCode) {
      this.detachSavedSelection();
    }
    this.resolvedAccount.set(null);
    this.lookup$.next();
  }

  protected onAccountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    input.value = digits;
    this.form.controls['accountNumber'].setValue(digits);
    this.error.set(null);
    if (this.selectedSavedId() && digits !== this.selectedSaved()?.accountNumber) {
      this.detachSavedSelection();
    }
    if (digits.length === 10) this.lookup$.next();
    else {
      this.resolvedAccount.set(null);
      this.resolveError.set(null);
    }
  }

  private detachSavedSelection(): void {
    if (!this.selectedSavedId()) return;
    this.selectedSavedId.set(null);
    this.saveAccount.set(!this.atLimit());
  }

  protected isCurrentAccountSaved(): boolean {
    const bank = this.selectedBank();
    const account = this.resolvedAccount();
    if (!bank || !account) return false;
    return this.savedAccounts().some((row) => (
      row.bankCode === bank.code && row.accountNumber === account.accountNumber
    ));
  }

  protected destinationLabel(): string {
    const saved = this.selectedSaved();
    if (saved) return `${saved.bankName} · •••• ${saved.accountLast4}`;
    const bank = this.selectedBank();
    const account = this.resolvedAccount();
    if (bank && account) return `${bank.name} · •••• ${account.accountNumber.slice(-4)}`;
    return 'Choose an account';
  }

  protected maskedAccount(): string {
    const number = this.resolvedAccount()?.accountNumber ?? '';
    return number.length >= 4 ? `•••• ${number.slice(-4)}` : '—';
  }

  protected setAmountPercent(ratio: number): void {
    const value = ratio >= 1 ? this.balance : Math.floor(this.balance * ratio);
    this.form.controls['amount'].setValue(value);
  }

  protected amountValue(): number {
    return Number(this.form.controls['amount'].value ?? 0);
  }

  protected money(value: number): string {
    return formatMoney(value, 2);
  }

  protected ready(): boolean {
    return !!this.selectedBank() && !!this.resolvedAccount() && this.form.valid && !this.loading();
  }

  protected review(): void {
    this.bankTouched.set(true);
    this.form.markAllAsTouched();
    this.error.set(null);
    this.resolveError.set(null);
    if (!this.ready()) {
      if (!this.selectedBank()) this.error.set('Choose your bank first.');
      else if (!this.resolvedAccount()) this.error.set('Enter a valid account number so Paystack can show the account name.');
      else if (this.form.controls['amount'].invalid) this.error.set('Enter a valid amount to withdraw.');
      return;
    }
    this.reviewing.set(true);
  }

  protected submit(): void {
    const bank = this.selectedBank();
    const account = this.resolvedAccount();
    if (!bank || !account || this.loading()) return;
    this.passwordControl.markAsTouched();
    if (this.passwordControl.invalid) {
      this.error.set('Enter your account password to confirm this withdrawal.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.paymentService.requestWithdrawal({
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: account.accountNumber,
      amountNgn: this.amountValue(),
      saveAccount: this.selectedSavedId() ? false : this.saveAccount(),
      password: this.passwordControl.value,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.loading.set(false);
        const paid = res.data.status === 'Paid';
        const limitReached = res.data.savedAccount?.reason === 'LIMIT_REACHED';
        this.dialogRef.close(res.data);
        void this.ui.alert({
          title: paid ? 'Withdrawal paid' : 'Withdrawal on the way',
          message: `${paid
            ? `${this.money(res.data.amountNgn)} was sent to ${res.data.accountName} (${res.data.bank} · ${res.data.accountNumber}).`
            : `${this.money(res.data.amountNgn)} is on its way to ${res.data.accountName} (${res.data.bank} · ${res.data.accountNumber}). You will be notified when it settles.`}${limitReached
            ? '\n\nYour account was not saved because you already have five saved accounts.'
            : ''}`,
          tone: limitReached ? 'warning' : 'success',
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(userError(err));
        this.passwordControl.reset('');
      },
    });
  }

  protected backToForm(): void {
    this.reviewing.set(false);
    this.passwordControl.reset('');
    this.showPassword.set(false);
    this.error.set(null);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
