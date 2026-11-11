import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { BankOption, PaystackService, ResolvedAccount, SavedWithdrawalAccount } from './paystack.service';

/**
 * Modern withdrawal dialog.
 *
 * Bank is a searchable autocomplete; account number triggers a debounced
 * Paystack name lookup; the review step shows exactly where the money goes
 * before the wallet is debited. The server re-resolves the account before
 * accepting the request, so the displayed name can never be forged.
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
          <p class="sub">Send money to your Nigerian bank account.</p>
        </div>
        <button mat-icon-button type="button" aria-label="Close withdrawal dialog" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <mat-dialog-content>
        <div class="balance-row">
          <span>Available balance</span>
          <strong>{{ money(balance) }}</strong>
        </div>

        <form [formGroup]="form" (ngSubmit)="review()" novalidate>
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

          <div class="save-toggle">
            <mat-slide-toggle [checked]="saveAccount()" (change)="saveAccount.set($any($event).checked)">
              Save this account for future withdrawals
            </mat-slide-toggle>
            <p class="toggle-hint">
              @if (savedAccountLoaded()) {
                Loaded from your saved payout account. Turn this off and submit to remove it.
              } @else if (saveAccount()) {
                Your bank and account number will be filled in automatically next time.
              } @else {
                This account will not be saved after this withdrawal.
              }
            </p>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Amount</mat-label>
            <span matTextPrefix>₦</span>
            <input matInput type="number" formControlName="amount" [max]="balance" min="100" step="100" />
            <button matSuffix mat-button type="button" (click)="form.patchValue({ amount: balance })">Max</button>
            <mat-hint>Minimum ₦100 · {{ money(balance) }} available</mat-hint>
            @if (form.controls['amount'].touched && form.controls['amount'].hasError('required')) {
              <mat-error>Amount is required.</mat-error>
            } @else if (form.controls['amount'].touched && form.controls['amount'].hasError('min')) {
              <mat-error>The minimum withdrawal is ₦100.</mat-error>
            } @else if (form.controls['amount'].touched && form.controls['amount'].hasError('max')) {
              <mat-error>You cannot withdraw more than your available balance.</mat-error>
            }
          </mat-form-field>
        </form>

        @if (error(); as err) {
          <p class="error" role="alert">{{ err }}</p>
        }

        @if (!reviewing()) {
          <button mat-flat-button color="primary" type="button" class="cta" [disabled]="loading()" (click)="review()">
            Review withdrawal
          </button>
        } @else {
          <div class="review" role="status">
            <p class="eyebrow">Confirm destination</p>
            <dl>
              <div><dt>Bank</dt><dd>{{ selectedBank()?.name }}</dd></div>
              <div><dt>Account</dt><dd>{{ resolvedAccount()?.accountName }}</dd></div>
              <div><dt>Number</dt><dd>{{ resolvedAccount()?.accountNumber }}</dd></div>
              <div><dt>Amount</dt><dd>{{ money(amountValue()) }}</dd></div>
            </dl>
            <p class="muted">Your wallet is debited now and the payout is sent automatically. If Paystack cannot complete it, the full amount is refunded.</p>
            <div class="review-actions">
              <button mat-stroked-button type="button" (click)="reviewing.set(false)" [disabled]="loading()">Back</button>
              <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="loading()">
                {{ loading() ? 'Submitting…' : 'Confirm withdrawal' }}
              </button>
            </div>
          </div>
        }
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    .withdraw-dialog { width: min(92vw, 520px); }
    .withdraw-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1em; padding: 1.2em 1.4em 0.2em; }
    .withdraw-head h2 { margin: 0.1em 0 0.2em; font-size: 1.35rem; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .sub { margin: 0; color: var(--ms-text-muted); font-size: 0.88rem; }
    mat-dialog-content { padding: 0.8em 1.4em 1.4em; max-height: 72vh; }
    .balance-row { display: flex; justify-content: space-between; align-items: center; gap: 1em; padding: 0.8em 0.9em; margin-bottom: 1em; border-radius: 12px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .balance-row strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
    form { display: flex; flex-direction: column; gap: 0.35em; }
    mat-form-field { width: 100%; }
    .lookup { display: flex; align-items: center; gap: 0.6em; margin: 0.2em 0 0.8em; color: var(--ms-text-muted); font-size: 0.86em; }
    .lookup mat-progress-bar { flex: 1; }
    .resolved { display: flex; align-items: center; gap: 0.65em; margin: 0.2em 0 0.9em; padding: 0.7em 0.85em; border: 1px solid var(--ms-success); border-radius: 10px; background: var(--ms-success-soft); color: var(--ms-success); }
    .resolved mat-icon { flex: none; }
    .resolved div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .resolved strong { font-size: 0.95em; overflow-wrap: anywhere; }
    .resolved span { font-size: 0.8em; opacity: 0.85; }
    .save-toggle { display: flex; flex-direction: column; gap: 0.2em; margin: 0.1em 0 0.9em; padding: 0.55em 0.7em; border: 1px solid var(--ms-line); border-radius: 10px; background: var(--ms-canvas); }
    .save-toggle mat-slide-toggle { font-size: 0.84em; font-weight: 600; }
    .toggle-hint { margin: 0; color: var(--ms-text-muted); font-size: 0.76em; line-height: 1.4; }
    .error { margin: 0.25em 0 0.7em; color: var(--ms-error); font-size: 0.86em; line-height: 1.4; }
    .cta { width: 100%; min-height: 46px; }
    .muted { color: var(--ms-text-muted); font-size: 0.84em; line-height: 1.5; }
    .review { margin-top: 0.8em; padding: 0.9em; border: 1px solid var(--ms-line); border-radius: 12px; background: var(--ms-canvas); }
    .review dl { display: grid; gap: 0.45em; margin: 0.7em 0; }
    .review dl div { display: flex; justify-content: space-between; gap: 1em; font-size: 0.9em; }
    .review dt { color: var(--ms-text-muted); }
    .review dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
    .review-actions { display: flex; gap: 0.5em; justify-content: flex-end; margin-top: 0.8em; }
    @media (max-width: 480px) {
      .withdraw-head, mat-dialog-content { padding-inline: 1em; }
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

  protected readonly balance = Number(this.partner?.balance ?? 0);
  protected readonly form: FormGroup = this.fb.group({
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    amount: [null as number | null, [Validators.required, Validators.min(100), Validators.max(this.balance)]],
  });

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
  protected readonly saveAccount = signal(false);
  protected readonly savedAccount = signal<SavedWithdrawalAccount | null>(null);
  protected readonly savedAccountLoaded = signal(false);

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
        next: (banks) => this.banks.set(banks),
        error: () => this.error.set('Could not load the bank list. Close and try again.'),
      });

    this.paymentService.savedWithdrawalAccount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          if (saved?.saved && saved.account) this.applySavedAccount(saved.account);
        },
        error: () => { /* saved account is optional; never block the form */ },
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

  protected onBankQuery(value: string): void {
    this.bankQuery.set(value);
    this.bankTouched.set(true);
    if (this.savedAccountLoaded() && value !== this.savedAccount()?.bankName) {
      this.savedAccountLoaded.set(false);
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
    if (this.savedAccountLoaded() && bank.code !== this.savedAccount()?.bankCode) {
      this.savedAccountLoaded.set(false);
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
    if (this.savedAccountLoaded() && digits !== this.savedAccount()?.accountNumber) {
      this.savedAccountLoaded.set(false);
    }
    if (digits.length === 10) this.lookup$.next();
    else {
      this.resolvedAccount.set(null);
      this.resolveError.set(null);
    }
  }

  private applySavedAccount(account: SavedWithdrawalAccount): void {
    if (this.form.dirty || this.bankTouched()) return;
    this.savedAccount.set(account);
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
    this.saveAccount.set(true);
    this.savedAccountLoaded.set(true);
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
      return;
    }
    this.reviewing.set(true);
  }

  protected submit(): void {
    const bank = this.selectedBank();
    const account = this.resolvedAccount();
    if (!bank || !account || this.loading()) return;
    this.loading.set(true);
    this.paymentService.requestWithdrawal({
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: account.accountNumber,
      amountNgn: this.amountValue(),
      saveAccount: this.saveAccount(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.loading.set(false);
        const paid = res.data.status === 'Paid';
        this.dialogRef.close(res.data);
        void this.ui.alert({
          title: paid ? 'Withdrawal paid' : 'Withdrawal on the way',
          message: paid
            ? `${this.money(res.data.amountNgn)} was sent to ${res.data.accountName} (${res.data.bank} · ${res.data.accountNumber}).`
            : `${this.money(res.data.amountNgn)} is on its way to ${res.data.accountName} (${res.data.bank} · ${res.data.accountNumber}). You will be notified when it settles.`,
          tone: 'success',
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(userError(err));
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
