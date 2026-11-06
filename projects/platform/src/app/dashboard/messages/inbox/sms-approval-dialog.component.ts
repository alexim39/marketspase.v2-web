import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface SmsApprovalData {
  name: string;
  maskedPhone: string | null;
  unitCost: number;
  offlineNote: string;
  initialBody?: string;
}

const SMS_PAGE_CHARS = 160;

/**
 * Explicit per-message approval for the SMS fallback.
 * Shows who gets it (masked number), the exact wallet charge computed
 * with the same 160-char paging the server bills, and requires an
 * explicit Send-as-SMS tap — nothing ever sends silently.
 */
@Component({
  selector: 'async-sms-approval',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h2 mat-dialog-title><mat-icon>sms</mat-icon> Send as SMS?</h2>
    <mat-dialog-content>
      <p class="muted">{{ data.name }} {{ data.offlineNote }}. In-app messages wait until they're back — SMS reaches their phone now.</p>
      <mat-form-field appearance="outline" class="body-field">
        <mat-label>Message text</mat-label>
        <textarea matInput rows="3" maxlength="960" [value]="body()" (input)="body.set($any($event.target).value)"></textarea>
        <mat-hint align="end">{{ pages() }} page{{ pages() === 1 ? '' : 's' }} · {{ masked() }}</mat-hint>
      </mat-form-field>
      <p class="cost" role="status">
        <mat-icon>payments</mat-icon>
        <span><strong>₦{{ cost().toFixed(2) }}</strong> will leave your wallet. This cannot be undone.</span>
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close(false)" [disabled]="sending()">Keep in chat</button>
      <button mat-flat-button color="primary" (click)="close(true)" [disabled]="sending() || !body().trim()">
        {{ sending() ? 'Sending…' : 'Send SMS' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 0.4em; }
    .muted { color: var(--ms-text-muted); font-size: 0.9em; }
    .body-field { width: 100%; min-width: min(22em, 70vw); }
    .cost { display: flex; align-items: center; gap: 0.5em; background: var(--ms-primary-soft); border: 1px solid var(--ms-primary); border-radius: 8px; padding: 0.6em 0.8em; font-size: 0.9em; }
    .cost mat-icon { color: var(--ms-primary-strong); }
  `],
})
export class SmsApprovalDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SmsApprovalDialogComponent>);
  readonly data = inject<SmsApprovalData>(MAT_DIALOG_DATA);
  protected readonly sending = signal(false);
  protected readonly body = signal(this.data.initialBody ?? '');

  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.body().trim().length / SMS_PAGE_CHARS)));

  protected readonly cost = computed(() =>
    Math.round(this.pages() * Number(this.data.unitCost ?? 0) * 100) / 100);

  protected readonly masked = computed(() =>
    this.data.maskedPhone ? `to ${this.data.maskedPhone}` : 'number on file');

  setSending(v: boolean): void {
    this.sending.set(v);
  }

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed ? this.body().trim() : null);
  }
}
