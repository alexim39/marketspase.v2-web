import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminPagesService, AdminPublicPage } from './admin-pages.service';
import { ApiError, userError } from '../../../core/http/api-error';
import { timeAgo } from '../../../_common/date-util';

type ResetSection = 'hero' | 'story' | 'opportunity' | 'proof' | 'contact' | 'all';

/**
 * @title Public pages — admin desk for /:username landing content.
 *
 * Moderation surface: completeness per partner, inspect full landing payload,
 * reset one section (or all) when content is inappropriate. Account hard-delete
 * stays in Admin → Members → erase (GDPR flow) — this desk never deletes
 * accounts, only clears page content (audited server-side).
 */
@Component({
  selector: 'async-admin-pages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSelectModule, MatTableModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Public pages</span>
      </div>
    </section>

    <section class="page">
      <div class="page-head">
        <div>
          <h2>Public pages</h2>
          <p class="subtitle">Every partner's one-pager (/:username) — completeness, inspect, reset bad content. Account deletion lives under Members.</p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }
      @if (loading() && rows().length === 0) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="reload()">Retry</button></p>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-label>Search username, name, email</mat-label>
          <input matInput type="search" [(ngModel)]="query" (keyup.enter)="skip.set(0); reload()" maxlength="80" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Completeness</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value); skip.set(0); reload()">
            <mat-option value="all">All</mat-option>
            <mat-option value="complete">Complete (80%+)</mat-option>
            <mat-option value="partial">Partial</mat-option>
            <mat-option value="empty">Empty</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-button (click)="skip.set(0); reload()">Apply</button>
      </div>

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="page">
              <th mat-header-cell *matHeaderCellDef>Page</th>
              <td mat-cell *matCellDef="let row" class="name-cell">
                <div>/{{ row.username }}</div>
                <div class="muted">{{ row.name }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="complete">
              <th mat-header-cell *matHeaderCellDef>Complete</th>
              <td mat-cell *matCellDef="let row">{{ row.completeness }}%</td>
            </ng-container>
            <ng-container matColumnDef="proof">
              <th mat-header-cell *matHeaderCellDef>Content</th>
              <td mat-cell *matCellDef="let row">
                <div class="muted">{{ row.opportunityCount }} points · {{ row.socials }} socials</div>
                <div class="muted">{{ row.hasStory ? 'story ✓' : 'no story' }} · {{ row.hasTestimonial ? 'proof ✓' : 'no proof' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="updated">
              <th mat-header-cell *matHeaderCellDef>Updated</th>
              <td mat-cell *matCellDef="let row">{{ ageOf(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="manage">
              <th mat-header-cell *matHeaderCellDef>Manage</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="inspect(row)">Inspect</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ total() }} pages</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No pages match — clear the filters.</p>
      }

      @if (detail(); as d) {
        <div class="dp-card detail-card" role="region" aria-label="Public page details">
          <h3>/{{ d.username }} <span class="muted">{{ d.name }}</span></h3>
          <div class="answers">
            @for (entry of landingEntries(); track entry[0]) {
              <div class="answer">
                <span class="muted">{{ labelOf(entry[0]) }}</span>
                <strong>{{ str(entry[1]) || '—' }}</strong>
              </div>
            }
          </div>
          <div class="reassign">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Reset section</mat-label>
              <mat-select [(value)]="resetSection">
                <mat-option value="hero">Hero</mat-option>
                <mat-option value="story">Story</mat-option>
                <mat-option value="opportunity">Opportunity</mat-option>
                <mat-option value="proof">Proof</mat-option>
                <mat-option value="contact">Contact &amp; social</mat-option>
                <mat-option value="all">Everything</mat-option>
              </mat-select>
            </mat-form-field>
            @if (confirmReset()) {
              <span class="muted">Clears {{ resetSection }} content for /{{ d.username }}. Account untouched.</span>
              <button mat-flat-button color="warn" (click)="reset(d)" [disabled]="acting()">Confirm reset</button>
              <button mat-button (click)="confirmReset.set(false)">Back</button>
            } @else {
              <button mat-button color="warn" (click)="confirmReset.set(true)">Reset section</button>
            }
          </div>
          @if (actionError(); as aerr) {
            <p class="error" role="alert">{{ aerr }}</p>
          }
          <div class="row">
            <button mat-button (click)="close()">Close</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 48em; }
    .notice { color: var(--ms-success); }
    .error { color: var(--ms-error); }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar .search-field { flex: 1 1 220px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .pager { display: flex; align-items: center; gap: 1em; }
    .empty { color: var(--ms-text-muted); }
    .detail-card { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .detail-card h3 { margin: 0; }
    .answers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5em; }
    .answer { display: flex; flex-direction: column; gap: 0.1em; border-left: 3px solid var(--ms-line); padding-left: 0.6em; }
    .answer strong { word-break: break-word; }
    .reassign { display: flex; gap: 0.5em; align-items: center; flex-wrap: wrap; }
    .row { display: flex; gap: 0.5em; flex-wrap: wrap; align-items: center; }
    button { min-height: 44px; }
  `],
})
export class AdminPagesComponent implements OnInit {
  private readonly pages = inject(AdminPagesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['page', 'complete', 'proof', 'updated', 'manage'];
  protected readonly rows = signal<AdminPublicPage[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected readonly status = signal('all');
  protected query = '';
  protected resetSection: ResetSection = 'all';
  protected readonly detail = signal<{ username: string; name: string; id: string } & { landing: Record<string, string | string[]> } | null>(null);
  protected readonly acting = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly confirmReset = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.pages
      .list({
        ...(this.query.trim() ? { q: this.query.trim() } : {}),
        ...(this.status() !== 'all' ? { status: this.status() } : {}),
        limit: this.limit(),
        skip: this.skip(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.total.set(res.data?.total ?? 0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected page(direction: 1 | -1): void {
    this.skip.set(Math.max(0, this.skip() + direction * this.limit()));
    this.reload();
  }

  protected ageOf(row: AdminPublicPage): string {
    return row.updatedAt ? timeAgo(new Date(row.updatedAt)) : '—';
  }

  protected str(v: unknown): string {
    if (Array.isArray(v)) return v.join(' · ');
    return v === undefined || v === null ? '' : String(v);
  }

  protected labelOf(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  protected landingEntries(): Array<[string, unknown]> {
    const l = this.detail()?.landing ?? {};
    return Object.entries(l).filter(([, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return String(v ?? '').trim() !== '';
    });
  }

  protected inspect(row: AdminPublicPage): void {
    this.actionError.set(null);
    this.confirmReset.set(false);
    this.pages
      .inspect(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const d = res.data;
          if (d) this.detail.set({ id: d.id, username: d.username, name: d.name, landing: d.landing });
        },
        error: (err: ApiError) => this.error.set(userError(err)),
      });
  }

  protected reset(d: { id: string; username: string }): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.pages
      .reset(d.id, this.resetSection)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.acting.set(false);
          this.confirmReset.set(false);
          this.detail.set(null);
          this.notice.set(res.message ?? `/${d.username} section cleared.`);
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.actionError.set(userError(err));
        },
      });
  }

  protected close(): void {
    this.detail.set(null);
    this.confirmReset.set(false);
  }
}
