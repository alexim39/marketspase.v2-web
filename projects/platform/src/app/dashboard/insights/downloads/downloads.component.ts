import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ExportFormat, ExportKind, ExportService } from '../../../core/analytics/export.service';
import { ApiError } from '../../../core/http/api-error';

const EXPORTS: Array<{ kind: ExportKind; title: string; body: string }> = [
  { kind: 'team', title: 'Team list', body: 'Everyone in your downline with levels and activity.' },
  { kind: 'pipeline', title: 'Prospect pipeline', body: 'Every prospect, stage and follow-up state.' },
  { kind: 'commissions', title: 'Growth commissions', body: 'Your growth commission entries, rank at accrual and mentor bonuses.' },
  { kind: 'reports-mine', title: 'My reports', body: 'Reports you submitted to your upline.' },
  { kind: 'reports-team', title: 'Team reports', body: 'What your downline submitted to you.' },
  { kind: 'community', title: 'Community activity', body: 'Posts, engagement and participation.' },
];

/**
 * @title Reports & downloads — export your business data.
 *
 * One card per dataset backed by `/v1/exports/*` (CSV or XLSX, saved to
 * the device). OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-downloads',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/insights">Insights</a> &gt;
        <span>Reports & downloads</span>
      </div>
    </section>

    <section class="downloads-page">
      <div class="page-head">
        <div>
          <h2>Reports & downloads</h2>
          <p class="subtitle">Take your business data with you — pick a dataset and a format.</p>
        </div>
        <mat-button-toggle-group [value]="format()" (change)="format.set($event.value)" aria-label="Export format">
          <mat-button-toggle value="csv">CSV</mat-button-toggle>
          <mat-button-toggle value="xlsx">Excel</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (error(); as err) {
        <p class="error" role="alert">{{ err }}</p>
      }

      <ul class="card-list">
        @for (item of exports; track item.kind) {
          <li class="dp-card export-card">
            <div>
              <strong>{{ item.title }}</strong>
              <p class="muted">{{ item.body }}</p>
            </div>
            <button
              mat-button
              (click)="download(item.kind)"
              [disabled]="busyKey() === item.kind"
            >
              <mat-icon>download</mat-icon>
              {{ busyKey() === item.kind ? 'Preparing…' : 'Download' }}
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .downloads-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .card-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75em; }
    .export-card { padding: 1em; display: flex; justify-content: space-between; align-items: center; gap: 0.75em; }
    .export-card p { margin: 0.25em 0 0; }
    .export-card button { flex: none; min-height: 44px; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); }
  `],
})
export class DownloadsComponent {
  private readonly exportsApi = inject(ExportService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly exports = EXPORTS;
  protected readonly format = signal<ExportFormat>('csv');
  protected readonly busyKey = signal<ExportKind | null>(null);
  protected readonly error = signal<string | null>(null);

  protected download(kind: ExportKind): void {
    if (this.busyKey()) return;
    this.busyKey.set(kind);
    this.error.set(null);
    this.exportsApi
      .download(kind, this.format())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.busyKey.set(null),
        error: (err: ApiError) => {
          this.busyKey.set(null);
          this.error.set(err.message);
        },
      });
  }
}
