import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { AdminPlanService } from './admin-plan.service';
import { ApiError } from '../../../core/http/api-error';

/**
 * @title Shop commission plan (legacy) — unilevel rates by level.
 *
 * This edits the LEGACY product-shop plan only: rates apply to the purchase
 * total on the referral chain. Partner growth compensation is the fixed
 * gross-margin plan shown on the admin Compensation desk.
 * Saving rotates to a new row (history preserved server-side); new rates
 * apply to FUTURE shop accrues only. OnPush + signals.
 */
@Component({
  selector: 'async-admin-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, PercentPipe, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Shop commission plan (legacy)</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Shop commission plan (legacy)</h2>
          <p class="subtitle">Legacy unilevel rates for product-shop purchases only, as a share of the purchase total on the referral chain. Partner growth compensation is separate and fixed.</p>
        </div>
      </div>

      <div class="dp-card legacy-note">
        <mat-icon>info</mat-icon>
        <div>
          <strong>This does not change partner growth commissions.</strong>
          <p>
            Growth partners earn the fixed gross-margin plan (9 / 4.5 / 2.5 / 1.5 / 1%, rank-depth capped)
            shown on <a routerLink="/compensation">Compensation</a>. Changes here only affect
            future shop-purchase accruals on the legacy referral chain.
          </p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status"><mat-icon>check_circle</mat-icon> {{ note }}</p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (plan(); as p) {
        <div class="dp-card plan-card">
          <h3>{{ p.name }}</h3>
          <p class="muted">Active since {{ p.updatedAt | date:'medium' }} · {{ p.rates.length }} levels · total {{ totalOf(p.rates) | percent:'1.0-2' }}</p>
          @for (rate of editRates(); track $index; let i = $index) {
            <mat-form-field appearance="outline">
              <mat-label>Level {{ i + 1 }} rate (0–1)</mat-label>
              <input matInput type="number" [value]="rate" (input)="setRate(i, $any($event.target).valueAsNumber)" min="0.001" max="1" step="0.005" />
            </mat-form-field>
          }
          @if (formError(); as ferr) {
            <p class="error" role="alert">{{ ferr }}</p>
          }
          <div class="edit-actions">
            <button mat-button (click)="addLevel()" [disabled]="editRates().length >= 5">Add level</button>
            <button mat-button color="warn" (click)="removeLevel()" [disabled]="editRates().length <= 1">Remove level</button>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Plan name</mat-label>
              <input matInput [value]="planName()" (input)="planName.set($any($event.target).value)" maxlength="120" />
            </mat-form-field>
            <span class="spacer"></span>
            @if (confirming()) {
              <button mat-flat-button color="warn" (click)="save()" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Confirm new plan?' }}</button>
              <button mat-button (click)="confirming.set(false)">Cancel</button>
            } @else {
              <button mat-flat-button color="primary" (click)="confirming.set(true)" [disabled]="!valid()">Review & activate</button>
            }
          </div>
          @if (saveError(); as err) {
            <p class="error" role="alert">{{ err }}</p>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { display: flex; align-items: center; gap: 0.5em; background: var(--ms-success-soft); color: var(--ms-success); border-radius: 8px; padding: 0.7em 1em; margin: 0; }
    .legacy-note { display: flex; gap: 0.75em; align-items: flex-start; padding: 0.9em 1em; border-left: 4px solid var(--ms-warning); }
    .legacy-note p { margin: 0.3em 0 0; line-height: 1.5; color: var(--ms-text-muted); }
    .legacy-note a { color: var(--ms-primary-strong); font-weight: 600; }
    .plan-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; max-width: 560px; }
    .plan-card h3 { margin: 0; }
    .edit-actions { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; }
    .edit-actions .spacer { flex: 1; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    button { min-height: 44px; }
  `],
})
export class AdminPlanComponent implements OnInit {
  private readonly plans = inject(AdminPlanService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly confirming = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly plan = signal<{ id: string; name: string; rates: number[]; updatedAt: string | null } | null>(null);
  protected readonly editRates = signal<number[]>([]);
  protected readonly planName = signal('');

  ngOnInit(): void {
    this.reload();
  }

  protected totalOf(rates: number[]): number {
    return rates.reduce((s, r) => s + (Number(r) || 0), 0);
  }

  protected valid(): boolean {
    const rates = this.editRates();
    if (rates.length < 1 || rates.length > 5) return false;
    if (rates.some((r) => !Number.isFinite(r) || r <= 0 || r > 1)) return false;
    return this.totalOf(rates) <= 1;
  }

  protected formError(): string | null {
    const rates = this.editRates();
    if (rates.some((r) => !Number.isFinite(r) || r <= 0 || r > 1)) return 'Each rate must be between 0 and 1.';
    if (this.totalOf(rates) > 1) return `Rates total ${(this.totalOf(rates) * 100).toFixed(1)}% — must stay at or under 100%.`;
    return null;
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.plans
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const p = res.data;
          this.plan.set(p ?? null);
          this.editRates.set([...(p?.rates ?? [])]);
          this.planName.set(p?.name ?? '');
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected setRate(i: number, value: number): void {
    this.editRates.update((rs) => {
      const next = [...rs];
      next[i] = value;
      return next;
    });
  }

  protected addLevel(): void {
    this.editRates.update((rs) => (rs.length >= 5 ? rs : [...rs, 0.01]));
  }

  protected removeLevel(): void {
    this.editRates.update((rs) => (rs.length <= 1 ? rs : rs.slice(0, -1)));
  }

  protected save(): void {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.notice.set(null);
    this.plans
      .save(this.editRates(), this.planName())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.confirming.set(false);
          const p = res.data;
          this.plan.set(p ?? null);
          this.editRates.set([...(p?.rates ?? [])]);
          this.notice.set('New plan active — future accrues use these rates.');
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.saveError.set(err.message);
        },
      });
  }
}
