import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminRecycleBinService, RecycleEntity, RecycleItem } from '../../../core/admin/recycle-bin.service';
import { ApiError } from '../../../core/http/api-error';
import { EmptyStateComponent } from '@marketspase/shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '@marketspase/shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '@marketspase/shared/ui/page-header/page-header.component';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';

const ENTITIES: Array<{ value: RecycleEntity; label: string }> = [
  { value: 'prospects', label: 'Prospects' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'goals', label: 'Goals' },
  { value: 'kits', label: 'Presentations' },
  { value: 'tutorials', label: 'Tutorials' },
  { value: 'events', label: 'Events' },
  { value: 'community-posts', label: 'Community posts' },
  { value: 'teams', label: 'Teams' },
  { value: 'subscriptions', label: 'Email subscriptions' },
];

@Component({
  selector: 'async-admin-recycle-bin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    EmptyStateComponent,
    ErrorStateComponent,
    PageHeaderComponent,
    PageSkeletonComponent,
    RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Recycle bin</span>
      </div>
    </section>

    <async-page-header
      eyebrow="Trust · Recovery"
      title="Recycle bin."
      subtitle="Restore soft-deleted records without touching the audit trail. Deleted finance rows are never purged here."
    />

    <section class="dp-card toolbar">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Record type</mat-label>
        <mat-select [value]="entity()" (selectionChange)="setEntity($event.value)">
          @for (option of entities; track option.value) {
            <mat-option [value]="option.value">{{ option.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
        <mat-label>Search</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput type="search" [value]="query()" (input)="setQuery($any($event.target).value)" placeholder="Name, email or title" />
      </mat-form-field>
      <button mat-stroked-button type="button" (click)="load()" [disabled]="loading()">
        <mat-icon>refresh</mat-icon> Refresh
      </button>
    </section>

    @if (notice(); as message) {
      <p class="notice" role="status"><mat-icon>check_circle</mat-icon>{{ message }}</p>
    }

    @if (loading()) {
      <async-page-skeleton layout="table" [rows]="6" label="deleted records" [showHeader]="false" />
    } @else if (error(); as err) {
      <async-error-state [message]="err" context="the recycle bin">
        <button mat-stroked-button type="button" (click)="load()">Try again</button>
        <a mat-button routerLink="/dashboard">Back to dashboard</a>
      </async-error-state>
    } @else if (rows().length === 0) {
      <async-empty-state
        icon="delete_sweep"
        title="Nothing in this bin"
        [message]="'No deleted ' + selectedLabel().toLowerCase() + ' match these filters.'"
        reason="This record type is either fully active or has no soft-deleted rows."
        next="Try another record type, clear the search, or restore from an existing row."
      />
    } @else {
      <div class="table-wrap dp-card">
        <table mat-table [dataSource]="rows()" aria-label="Deleted records">
          <ng-container matColumnDef="summary">
            <th mat-header-cell *matHeaderCellDef>Record</th>
            <td mat-cell *matCellDef="let row">
              <strong>{{ row.summary }}</strong>
              <span class="mono">{{ row.id }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="deletedAt">
            <th mat-header-cell *matHeaderCellDef>Deleted</th>
            <td mat-cell *matCellDef="let row">{{ row.deletedAt ? (row.deletedAt | date:'medium') : '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="deletedBy">
            <th mat-header-cell *matHeaderCellDef>By</th>
            <td mat-cell *matCellDef="let row" class="mono">{{ row.deletedBy || 'system' }}</td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>Action</th>
            <td mat-cell *matCellDef="let row">
              <button mat-flat-button color="primary" type="button"
                [disabled]="restoringId() === row.id"
                (click)="restore(row)">
                <mat-icon>{{ restoringId() === row.id ? 'hourglass_top' : 'restore' }}</mat-icon>
                {{ restoringId() === row.id ? 'Restoring…' : 'Restore' }}
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
        <mat-paginator
          [length]="total()"
          [pageSize]="limit()"
          [pageIndex]="pageIndex()"
          [pageSizeOptions]="[10, 25, 50, 100]"
          (page)="onPage($event)"
        ></mat-paginator>
      </div>
    }
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .toolbar { display: flex; gap: 0.8em; align-items: center; flex-wrap: wrap; padding: 1em; margin-bottom: 1em; }
    .toolbar mat-form-field { min-width: 190px; }
    .toolbar .search { flex: 1 1 260px; }
    .table-wrap { overflow-x: auto; border-radius: 10px; padding: 0.5em; }
    table { width: 100%; }
    td strong { display: block; }
    td .mono { display: block; font-family: var(--ms-font-mono); font-size: 0.78em; color: var(--ms-text-muted); margin-top: 0.2em; }
    .mono { font-family: var(--ms-font-mono); font-size: 0.8em; }
    .notice { display: flex; align-items: center; gap: 0.45em; margin: 0 0 0.8em; color: var(--ms-success); }
    button { min-height: 44px; }
  `],
})
export class AdminRecycleBinComponent implements OnInit {
  private readonly recycle = inject(AdminRecycleBinService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly entities = ENTITIES;
  protected readonly entity = signal<RecycleEntity>('prospects');
  protected readonly query = signal('');
  protected readonly rows = signal<RecycleItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly restoringId = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly limit = signal(25);
  protected readonly pageIndex = signal(0);

  protected readonly displayedColumns = ['summary', 'deletedAt', 'deletedBy', 'action'];

  protected selectedLabel(): string {
    return this.entities.find((option) => option.value === this.entity())?.label ?? 'Records';
  }

  ngOnInit(): void {
    this.load();
  }

  protected setEntity(value: RecycleEntity): void {
    this.entity.set(value);
    this.pageIndex.set(0);
    this.load();
  }

  protected setQuery(value: string): void {
    this.query.set(String(value ?? ''));
    this.pageIndex.set(0);
    this.load();
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.limit.set(event.pageSize);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const skip = this.pageIndex() * this.limit();
    this.recycle.list(this.entity(), { q: this.query(), limit: this.limit(), skip })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data ?? []);
          this.total.set(res.meta?.total ?? 0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected restore(row: RecycleItem): void {
    if (this.restoringId()) return;
    this.restoringId.set(row.id);
    this.notice.set(null);
    this.recycle.restore(row.entity, row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rows.update((current) => current.filter((item) => item.id !== row.id));
          this.total.update((value) => Math.max(0, value - 1));
          this.restoringId.set(null);
          this.notice.set(`${row.label[0].toUpperCase()}${row.label.slice(1)} restored.`);
        },
        error: (err: ApiError) => {
          this.restoringId.set(null);
          this.error.set(err.message);
        },
      });
  }
}
