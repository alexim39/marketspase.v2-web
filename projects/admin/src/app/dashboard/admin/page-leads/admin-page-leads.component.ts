import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
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
import { AdminPageLead, AdminPageLeadsService } from './admin-page-leads.service';
import { ApiError, userError } from '../../../core/http/api-error';
import { timeAgo } from '../../../_common/date-util';

/**
 * @title Page leads — admin desk for private /:username submissions.
 *
 * Every row here belongs to exactly one partner (username != 'business')
 * and is private to the partner. Admins can inspect full
 * survey answers, reassign a misattributed lead to the correct @username,
 * or hard-delete junk (two-step, audited server-side). Deleting removes the
 * survey row only — accepted pipeline copies are untouched.
 */
@Component({
  selector: 'async-admin-page-leads',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatSelectModule, MatTableModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Page leads</span>
      </div>
    </section>

    <section class="page">
      <div class="page-head">
        <div>
          <h2>Page leads</h2>
          <p class="subtitle">Private submissions via public pages (/:username) — inspect, reassign to the right owner, or hard-delete junk.</p>
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

      @if (summary(); as s) {
        <div class="kpi-grid">
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>inbox</mat-icon>
            <span class="kpi-value">{{ s.total | number }}</span>
            <span class="kpi-label">Private page leads</span>
          </mat-card-content></mat-card>
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>fiber_new</mat-icon>
            <span class="kpi-value">{{ s.new7d | number }}</span>
            <span class="kpi-label">New 7d</span>
          </mat-card-content></mat-card>
        </div>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-label>Search name, phone, email</mat-label>
          <input matInput type="search" [(ngModel)]="query" (keyup.enter)="skip.set(0); reload()" maxlength="60" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Owner @username</mat-label>
          <input matInput [(ngModel)]="owner" (keyup.enter)="skip.set(0); reload()" maxlength="80" placeholder="e.g. market" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value); skip.set(0); reload()">
            <mat-option value="all">All statuses</mat-option>
            <mat-option value="Not Moved">Not Moved</mat-option>
            <mat-option value="Claimed">Claimed</mat-option>
            <mat-option value="Moved to Contact">Moved to Contact</mat-option>
            <mat-option value="Returned from contact List">Returned</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-button (click)="skip.set(0); reload()">Apply</button>
      </div>

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Lead</th>
              <td mat-cell *matCellDef="let row" class="name-cell">{{ row.name }} {{ row.surname }}</td>
            </ng-container>
            <ng-container matColumnDef="owner">
              <th mat-header-cell *matHeaderCellDef>Owner</th>
              <td mat-cell *matCellDef="let row"><span class="owner">@{{ row.owner }}</span></td>
            </ng-container>
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact</th>
              <td mat-cell *matCellDef="let row">
                <div>{{ row.phoneNumber || '—' }}</div>
                <div class="muted">{{ row.email || '—' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef>Age</th>
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
          <span class="muted">{{ total() }} leads</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No page leads match — clear the filters.</p>
      }

      @if (inspected(); as lead) {
        <div class="dp-card detail-card" role="region" aria-label="Page lead details">
          <h3>{{ lead.name }} {{ lead.surname }} <span class="muted">@{{ lead.owner }}</span></h3>
          <p class="muted">{{ lead.phoneNumber || '—' }} · {{ lead.email || '—' }} · {{ lead.state || '—' }} · {{ lead.status }}</p>
          <div class="answers">
            @for (entry of answerEntries(lead); track entry[0]) {
              <div class="answer">
                <span class="muted">{{ labelOf(entry[0]) }}</span>
                <strong>{{ str(entry[1]) || '—' }}</strong>
              </div>
            }
          </div>
          <div class="reassign">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Move to @username</mat-label>
              <input matInput [(ngModel)]="reassignTo" maxlength="80" placeholder="e.g. market (not business)" />
              <mat-hint>Enter a real partner username — business is the shared pool and cannot own page leads.</mat-hint>
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="reassign(lead)" [disabled]="acting() || !reassignTo.trim()">Reassign</button>
          </div>
          @if (actionError(); as aerr) {
            <p class="error" role="alert">{{ aerr }}</p>
          }
          <div class="row">
            @if (confirmDelete() === lead.id) {
              <span class="muted">Hard delete removes this survey row permanently. Pipeline copies (if accepted) are untouched.</span>
              <button mat-flat-button color="warn" (click)="remove(lead)" [disabled]="acting()">Confirm hard delete</button>
              <button mat-button (click)="confirmDelete.set(null)">Back</button>
            } @else {
              <button mat-button color="warn" (click)="confirmDelete.set(lead.id)">Hard delete</button>
            }
            <button mat-button (click)="inspected.set(null)">Close</button>
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
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 46em; }
    .notice { color: var(--ms-success); }
    .error { color: var(--ms-error); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75em; }
    .kpi mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .kpi mat-icon { color: var(--ms-primary-strong); }
    .kpi-value { font-size: 1.5em; font-weight: 700; }
    .kpi-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar .search-field { flex: 1 1 200px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; }
    .owner { font-weight: 700; color: var(--ms-primary-strong); }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .pager { display: flex; align-items: center; gap: 1em; }
    .empty { color: var(--ms-text-muted); }
    .detail-card { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .detail-card h3 { margin: 0; }
    .answers { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5em; }
    .answer { display: flex; flex-direction: column; gap: 0.1em; border-left: 3px solid var(--ms-line); padding-left: 0.6em; }
    .reassign { display: flex; gap: 0.5em; align-items: center; flex-wrap: wrap; }
    .row { display: flex; gap: 0.5em; flex-wrap: wrap; align-items: center; }
    button { min-height: 44px; }
  `],
})
export class AdminPageLeadsComponent implements OnInit {
  private readonly leads = inject(AdminPageLeadsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['name', 'owner', 'contact', 'age', 'manage'];
  protected readonly rows = signal<AdminPageLead[]>([]);
  protected readonly total = signal(0);
  protected readonly summary = signal<{ total: number; new7d: number } | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected readonly status = signal('all');
  protected query = '';
  protected owner = '';
  protected reassignTo = '';
  protected readonly inspected = signal<AdminPageLead | null>(null);
  protected readonly acting = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly confirmDelete = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads
      .list({
        ...(this.query.trim() ? { q: this.query.trim() } : {}),
        ...(this.owner.trim() ? { owner: this.owner.trim() } : {}),
        ...(this.status() !== 'all' ? { status: this.status() } : {}),
        limit: this.limit(),
        skip: this.skip(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.total.set(res.data?.total ?? 0);
          this.summary.set(res.data?.summary ?? null);
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

  protected ageOf(row: AdminPageLead): string {
    return timeAgo(new Date(row.createdAt ?? Date.now()));
  }

  protected str(v: unknown): string {
    if (Array.isArray(v)) return v.join(', ');
    return v === undefined || v === null ? '' : String(v);
  }

  protected labelOf(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  protected answerEntries(lead: AdminPageLead): Array<[string, unknown]> {
    return Object.entries(lead.answers ?? {}).filter(([, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return String(v ?? '').trim() !== '';
    });
  }

  protected inspect(row: AdminPageLead): void {
    this.inspected.set(row);
    this.actionError.set(null);
    this.confirmDelete.set(null);
    this.reassignTo = '';
  }

  protected reassign(lead: AdminPageLead): void {
    const target = this.reassignTo.trim();
    if (!target || this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.leads
      .reassign(lead.id, target)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.acting.set(false);
          this.notice.set(res.message ?? `Moved to @${target}.`);
          this.inspected.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.actionError.set(userError(err));
        },
      });
  }

  protected remove(lead: AdminPageLead): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.leads
      .remove(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.acting.set(false);
          this.confirmDelete.set(null);
          this.inspected.set(null);
          this.notice.set(res.message ?? 'Page lead hard-deleted.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.actionError.set(userError(err));
        },
      });
  }
}
