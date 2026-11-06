import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { Member360 } from '../../../core/admin/admin.models';
import { ApiError, userError } from '../../../core/http/api-error';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @title Member 360 — the admin's answer to "who is this member?"
 *
 * Five panels, one read: identity/contact, login recency, money snapshot,
 * growth signals, journey + upline — with computed risk flags on top and
 * the member's own quick actions below (password reset, sign-out,
 * suspend/reactivate). Read-only dialog; the directory row stays the
 * action surface for destructive moves. OnPush + signals.
 */
@Component({
  selector: 'async-member-360-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Member 360</h2>
    <div mat-dialog-content class="body">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }
      @if (profile(); as p) {
        @if (p.risks.length > 0) {
          <div class="chip-row">
            @for (r of p.risks; track r.label) {
              <span class="dp-status" [class]="r.tone === 'bad' ? 'dp-status--bad' : 'dp-status--warn'">{{ r.label }}</span>
            }
          </div>
        }
        <div class="panel">
          <h3>Identity & contact</h3>
          <p class="name">{{ p.identity.name }} <span class="muted">@{{ p.identity.username ?? '—' }}</span></p>
          <div class="row"><mat-icon>mail</mat-icon><span>{{ p.identity.email ?? '—' }}</span></div>
          <div class="row"><mat-icon>call</mat-icon><span>{{ p.identity.phone ?? '—' }}</span></div>
          <div class="row"><mat-icon>location_on</mat-icon><span>{{ p.identity.state ?? '—' }} · joined {{ p.identity.createdAt | date:'mediumDate' }}</span></div>
          <div class="row"><mat-icon>badge</mat-icon><span>{{ p.identity.role }}@if (p.upline) { · upline {{ p.upline.name }}}@if (p.identity.suspended) { · suspended: {{ p.identity.suspendReason || 'no reason' }}}</span></div>
        </div>
        <div class="panel">
          <h3>Login</h3>
          @if (p.login.neverSeen) {
            <p class="warn">Never signed in.</p>
          } @else {
            <p>Last seen <strong>{{ loginAge(p) }}</strong> · {{ p.login.loginCount | number }} sign-ins</p>
          }
          <div class="row muted"><mat-icon>devices</mat-icon><span>{{ p.login.lastAgent ?? '—' }}</span></div>
          <div class="row muted"><mat-icon>cloud</mat-icon><span>{{ p.login.lastIp ?? '—' }}</span></div>
        </div>
        <div class="panel">
          <h3>Money</h3>
          <p>Wallet <strong>₦{{ p.money.balance | number:'1.0-2' }}</strong>@if (p.money.in30d !== null) { · ₦{{ p.money.in30d | number:'1.0-2' }} in (30d)}</p>
          @if (p.money.recent.length > 0) {
            <div class="mini">
              @for (t of p.money.recent; track $index) {
                <span>{{ t.kind === 'Credit' ? '+' : '−' }}₦{{ num(t.amount) | number:'1.0-0' }} {{ t.method }} · {{ t.at | date:'shortDate' }}</span>
              }
            </div>
          }
        </div>
        <div class="panel">
          <h3>Growth</h3>
          <p>{{ p.growth.activeLeads ?? '—' }} active leads · {{ p.growth.claims7d ?? '—' }} claims (7d)@if (p.growth.rating !== null) { · rated {{ p.growth.rating }}/5 ({{ p.growth.ratingCount }})}</p>
          <p class="muted">Deposits: {{ p.growth.deposits ?? '—' }}</p>
        </div>
        <div class="actions">
          <button mat-button (click)="openMemberView()" [disabled]="acting()">Open member 360</button>
          <button mat-button (click)="act('reset')" [disabled]="acting()">Reset password</button>
          <button mat-button (click)="act('signout')" [disabled]="acting()">Sign out</button>
          <button mat-button color="warn" (click)="act('suspend')" [disabled]="acting()">
            {{ p.identity.suspended ? 'Reactivate' : 'Suspend' }}
          </button>
        </div>
        @if (acting()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading" />
        }
        @if (actionError(); as aerr) {
          <p class="error" role="alert">{{ aerr }}</p>
        }
      }
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </div>
  `,
  styles: [`
    .body { display: flex; flex-direction: column; gap: 0.7em; min-width: min(420px, 82vw); }
    .chip-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .panel { border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.7em 0.8em; display: flex; flex-direction: column; gap: 0.35em; }
    .panel h3 { margin: 0; font-size: 0.78em; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ms-primary-strong); }
    .name { font-size: 1.1em; font-weight: 700; margin: 0; }
    .row { display: flex; align-items: center; gap: 0.5em; }
    .row mat-icon { font-size: 18px; height: 18px; width: 18px; color: var(--ms-text-muted); }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .warn { color: var(--ms-warning); font-weight: 600; margin: 0; }
    .mini { display: flex; flex-direction: column; gap: 0.15em; font-size: 0.85em; color: var(--ms-text-muted); }
    .actions { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .error { color: var(--ms-error); }
    button { min-height: 44px; }
  `],
})
export class Member360DialogComponent {
  private readonly dialogRef = inject(MatDialogRef<Member360DialogComponent>);
  private readonly data = inject<{ partnerId: string; onAction: (kind: 'reset' | 'signout' | 'suspend') => void }>(MAT_DIALOG_DATA);
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly profile = signal<Member360 | null>(null);
  protected readonly acting = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly num = num;

  constructor() {
    this.admin
      .member360(this.data.partnerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.profile.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected loginAge(p: Member360): string {
    if (p.login.neverSeen || p.login.daysSinceLogin === null) return 'never';
    if (p.login.daysSinceLogin <= 0) return 'today';
    if (p.login.daysSinceLogin === 1) return 'yesterday';
    if (p.login.daysSinceLogin < 30) return `${p.login.daysSinceLogin}d ago`;
    return `${Math.floor(p.login.daysSinceLogin / 30)}mo ago`;
  }

  protected act(kind: 'reset' | 'signout' | 'suspend'): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    try {
      this.data.onAction(kind);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : 'Action failed');
    } finally {
      this.acting.set(false);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected openMemberView(): void {
    const id = this.data.partnerId;
    void this.router.navigate(['/members', id]);
    this.dialogRef.close();
  }
}
