import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AdminSummaryService } from '../../../core/summaries/summary.service';
import { AdminSummary } from '../../../core/summaries/summary.models';
import { SummaryDistributionComponent } from '../../../core/summaries/summary-distribution.component';
import { SummaryTrendComponent } from '../../../core/summaries/summary-trend.component';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * Compact finance picture above the transaction ledger. The ledger answers
 * "what happened?"; this answers "is money moving healthily?" without making
 * an operator open the finance summary page.
 */
@Component({
  selector: 'async-admin-finance-snapshot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterModule,
    SummaryDistributionComponent,
    SummaryTrendComponent,
  ],
  template: `
    <section class="snapshot-card" aria-labelledby="finance-snapshot-title">
      <header class="snapshot-head">
        <div>
          <p class="eyebrow">Finance snapshot</p>
          <h2 id="finance-snapshot-title">Cash flow and payouts</h2>
          <p>Last 30 days. The ledger below is filtered separately.</p>
        </div>
        <a mat-stroked-button routerLink="/summaries/finance">
          <mat-icon>insights</mat-icon> Full summary
        </a>
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading finance snapshot" />
      } @else if (error(); as err) {
        <p class="snapshot-error" role="alert">{{ err }}</p>
      } @else if (summary(); as data) {
        <div class="snapshot-grid">
          @if (trend(); as t) {
            <div class="snapshot-block">
              <div class="block-head">
                <h3>{{ t.title }}</h3>
                <span>Weekly</span>
              </div>
              <async-summary-trend [labels]="t.labels" [series]="t.series" [format]="t.format || 'currency'" />
            </div>
          }
          @if (distribution(); as d) {
            <div class="snapshot-block">
              <div class="block-head">
                <h3>{{ d.title }}</h3>
                <span>Status</span>
              </div>
              <async-summary-distribution [items]="d.items" [kind]="d.type" [format]="d.format || 'currency'" />
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .snapshot-card {
      padding: 20px 22px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background:
        radial-gradient(360px 180px at 100% 0%, color-mix(in srgb, var(--ms-primary-soft) 62%, transparent), transparent 70%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .snapshot-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .snapshot-head h2 { margin: 4px 0 4px; font-size: 1.08rem; letter-spacing: -0.02em; }
    .snapshot-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.45; }
    .snapshot-head a { flex: none; }
    .snapshot-head mat-icon { margin-right: 4px; }

    .snapshot-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.65fr);
      gap: 18px;
      align-items: stretch;
    }
    .snapshot-block {
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: var(--ms-canvas);
    }
    .block-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 8px;
    }
    .block-head h3 { margin: 0; font-size: 0.84rem; }
    .block-head span { color: var(--ms-text-muted); font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .snapshot-error { margin: 0; color: var(--ms-error); font-size: 0.8rem; }

    @media (max-width: 900px) {
      .snapshot-grid { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 640px) {
      .snapshot-card { padding: 16px; }
      .snapshot-head a { width: 100%; justify-content: center; }
      .snapshot-block { padding: 12px; }
    }
  `],
})
export class AdminFinanceSnapshotComponent implements OnInit {
  private readonly summaries = inject(AdminSummaryService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<AdminSummary | null>(null);

  protected readonly trend = computed(() => {
    const data = this.summary();
    return data?.trends.find((item) => item.key === 'cashflow') ?? data?.trends[0] ?? null;
  });

  protected readonly distribution = computed(() => {
    const data = this.summary();
    return data?.distributions.find((item) => item.key === 'withdrawals')
      ?? data?.distributions[0]
      ?? null;
  });

  ngOnInit(): void {
    this.summaries.get('finance', 30)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.summary.set(res.data ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }
}
