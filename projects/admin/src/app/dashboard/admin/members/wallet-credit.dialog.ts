import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { WalletService } from '../../../core/wallet/wallet.service';
import { ApiError, userError } from '../../../core/http/api-error';

export interface WalletCreditData {
  id: string;
  name: string;
  balance: number;
}

/**
 * Direct wallet credit for corrections and bonuses. This is not a deposit
 * method: the server enforces a reason, audits the actor and notifies the
 * member. Manual bank-transfer deposits are retired.
 */
@Component({
  selector: 'async-admin-wallet-credit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="credit-dialog">
      <h2 mat-dialog-title>Credit wallet</h2>
      <mat-dialog-content>
        <p class="who"><strong>{{ data.name }}</strong><span>Current balance ₦{{ data.balance | number:'1.0-2' }}</span></p>
        <p class="note">Use this for corrections, bonuses or approved adjustments. Every credit is audited and the member is notified.</p>
        <mat-form-field appearance="outline">
          <mat-label>Amount (₦)</mat-label>
          <input matInput type="number" [(ngModel)]="amount" min="1" max="10000000" step="100" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Reason (at least 5 characters)</mat-label>
          <input matInput [(ngModel)]="reason" maxlength="500" placeholder="What is this credit for?" />
        </mat-form-field>
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close()" [disabled]="submitting()">Cancel</button>
        <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="!valid() || submitting()">
          {{ submitting() ? 'Crediting…' : 'Credit wallet' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .credit-dialog { width: min(92vw, 480px); }
    .who { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 0 0 8px; }
    .who span { color: var(--ms-text-muted); font-size: .8rem; }
    .note { margin: 0 0 14px; color: var(--ms-text-muted); font-size: .82rem; line-height: 1.5; }
    mat-form-field { width: 100%; }
    .error { margin: 4px 0; color: var(--ms-error); font-size: .82rem; }
  `],
})
export class AdminWalletCreditDialogComponent {
  readonly data = inject<WalletCreditData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AdminWalletCreditDialogComponent, boolean>);
  private readonly wallets = inject(WalletService);

  protected amount: number | null = null;
  protected reason = '';
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected valid(): boolean {
    const amount = Number(this.amount);
    return Number.isFinite(amount) && amount >= 1 && amount <= 10000000
      && this.reason.trim().length >= 5;
  }

  protected submit(): void {
    if (!this.valid() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.wallets.adminCredit(this.data.id, Number(this.amount), this.reason.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.dialogRef.close(true);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.error.set(userError(err));
      },
    });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
