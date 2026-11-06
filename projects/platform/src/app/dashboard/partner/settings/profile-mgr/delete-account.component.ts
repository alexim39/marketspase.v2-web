import { DatePipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../../core/auth/auth.service';
import { userError } from '../../../../core/http/api-error';

/**
 * @title Delete my account — self-service erasure (GDPR).
 *
 * Two states: idle (typed-username confirm → 30-day schedule) and pending
 * (countdown + one-click cancel). Execution, forfeiture and notices all run
 * server-side; this component only requests, cancels, and reflects state
 * from the `currentUser` signal (refreshed after each call).
 */
@Component({
  selector: 'async-delete-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <section class="dp-card danger" aria-label="Delete my account">
      <h3><mat-icon>warning</mat-icon> Delete my account</h3>
      <p class="dp-muted">
        Leaving MarketSpase deletes your profile, prospects, tickets and codes after a
        <strong>30-day review</strong> — cancel anytime before then. Financial records are
        retained as required by law, and any remaining wallet balance is forfeited to the ledger.
        Your direct downline moves up to your upline automatically — unless you have no upline,
        in which case reassign them first.
      </p>

      @if (scheduledFor(); as scheduled) {
        <p class="countdown" role="status">
          Deletion scheduled for <strong>{{ scheduled | date:'mediumDate' }}</strong>
          ({{ daysLeft() }} day{{ daysLeft() === 1 ? '' : 's' }} left).
        </p>
        @if (error(); as err) {
          <p class="error" role="alert">{{ err }}</p>
        }
        <div class="actions">
          <button mat-stroked-button (click)="cancel()" [disabled]="busy()">
            {{ busy() ? 'Working…' : 'Cancel deletion' }}
          </button>
        </div>
      } @else {
        @if (!arming()) {
          <div class="actions">
            <button mat-stroked-button color="warn" (click)="arming.set(true)">Delete my account…</button>
          </div>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>Type your username ({{ username() }}) to confirm</mat-label>
            <input matInput [ngModel]="confirmText()" (ngModelChange)="confirmText.set($event)" autocomplete="off" />
          </mat-form-field>
          @if (error(); as err) {
            <p class="error" role="alert">{{ err }}</p>
          }
          <div class="actions">
            <button mat-flat-button color="warn" (click)="request()" [disabled]="busy() || !matchesUsername()">
              {{ busy() ? 'Scheduling…' : 'Schedule deletion' }}
            </button>
            <button mat-button (click)="arming.set(false); confirmText.set(''); error.set(null)">Keep my account</button>
          </div>
        }
      }
      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }
    </section>
  `,
  styles: [`
    .danger { padding: 1.1em 1.2em; margin-top: 1em; border-left: 4px solid var(--ms-error); display: flex; flex-direction: column; gap: 0.7em; }
    .danger h3 { margin: 0; color: var(--ms-error); display: flex; align-items: center; gap: 0.4em; font-size: 1.05rem; }
    .danger p { margin: 0; }
    .countdown { font-size: 1.02rem; }
    .actions { display: flex; gap: 0.6em; flex-wrap: wrap; }
    .actions button { min-height: 44px; }
    mat-form-field { width: 100%; max-width: 340px; }
    .error { color: var(--ms-error); }
    .notice { color: var(--ms-success); }
  `],
})
export class DeleteAccountComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly arming = signal(false);
  readonly confirmText = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly username = computed(() => String(this.auth.currentUser()?.username ?? ''));
  readonly scheduledFor = computed(() => {
    const v = this.auth.currentUser()?.['eraseScheduledFor'];
    return typeof v === 'string' && v ? v : null;
  });

  daysLeft(): number {
    const at = this.scheduledFor();
    if (!at) return 0;
    return Math.max(0, Math.ceil((new Date(at).getTime() - Date.now()) / 86400000));
  }

  matchesUsername(): boolean {
    const want = this.username().trim().toLowerCase();
    return !!want && this.confirmText().trim().toLowerCase() === want;
  }

  request(): void {
    if (this.busy() || !this.matchesUsername()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.requestErasure()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.arming.set(false);
          this.confirmText.set('');
          this.notice.set(res.message ?? 'Deletion scheduled — cancel anytime before then.');
          this.refreshIdentity();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(userError(err) || 'Request failed — try again.');
        },
      });
  }

  cancel(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.cancelErasure()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.notice.set(res.message ?? 'Deletion cancelled.');
          this.refreshIdentity();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(userError(err) || 'Cancel failed — try again.');
        },
      });
  }

  private refreshIdentity(): void {
    this.auth.me().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  }
}
