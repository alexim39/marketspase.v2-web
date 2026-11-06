import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterModule } from '@angular/router';
import { AdminTicketsService, AdminTicket, TicketStatus } from './admin-tickets.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';

const STATUSES: TicketStatus[] = ['open', 'in-progress', 'resolved', 'closed'];

/**
 * @title Ticket inbox — support queue for admins.
 *
 * Filter by status, search, assign, move through the lifecycle, resolve
 * with a note (requester is notified in-app). Closed is terminal unless
 * reopened explicitly. OnPush + signals, token-blind dark shells.
 */
@Component({
  selector: 'async-admin-tickets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatTableModule, RouterModule],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Support tickets</span>
      </div>
    </section>

    <section class="queue-page">
      <div class="page-head">
        <div>
          <h2>Support tickets</h2>
          <p class="subtitle">Assign, work, and resolve member requests. Resolving notifies the requester in-app.</p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value); skip.set(0); reload()">
            <mat-option value="">All</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search</mat-label>
          <input matInput [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Subject, description, category" />
        </mat-form-field>
        <button mat-button (click)="skip.set(0); reload()">Apply</button>
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" class="loader" aria-label="Loading" />
        }
      </div>

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef>Ticket</th>
              <td mat-cell *matCellDef="let row" class="subject-cell">
                <strong>{{ row.subject }}</strong>
                <span class="muted">{{ row.category }} · {{ row.priority }} · {{ row.createdAt | date:'mediumDate' }}</span>
                <span class="muted">{{ row.description }}</span>
                <span class="reporter">
                  @if (row.reporter) {
                    <async-avatar [photo]="null" [name]="row.reporter.name" size="xs" />
                    <span>{{ row.reporter.name }} <span class="muted">@{{ row.reporter.username ?? '—' }}</span></span>
                  } @else {
                    <span class="muted">Reporter unavailable</span>
                  }
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <span [class]="statusClass(row.status)">{{ row.status }}</span>
                @if (row.assigneeId) {
                  <div class="muted">→ {{ shortId(row.assigneeId) }}</div>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef>Action</th>
              <td mat-cell *matCellDef="let row" class="action-cell">
                @if (openId() === row.id) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Move to</mat-label>
                    <mat-select [value]="row.status" (selectionChange)="moveTo.set($event.value)">
                      @for (s of statuses; track s) {
                        <mat-option [value]="s">{{ s }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Resolution note</mat-label>
                    <input matInput [value]="note()" (input)="note.set($any($event.target).value)" maxlength="2000" />
                  </mat-form-field>
                  <button mat-flat-button color="primary" (click)="save(row)" [disabled]="actingId() === row.id">
                    {{ actingId() === row.id ? 'Saving…' : 'Save' }}
                  </button>
                  @if (row.status === 'closed') {
                    <button mat-button (click)="reopen(row)" [disabled]="actingId() === row.id">Reopen</button>
                  }
                  <button mat-button (click)="openId.set(null)">Cancel</button>
                } @else {
                  <button mat-button (click)="assignMe(row)" [disabled]="actingId() === row.id">Assign me</button>
                  <button mat-button (click)="openWork(row)">Work</button>
                  <button mat-button (click)="openMember(row.partnerId)" [disabled]="!row.partnerId">Member 360</button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ total() }} tickets</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">Inbox clear — no tickets match.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .queue-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .notice { color: var(--ms-success); }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar mat-form-field { min-width: 200px; }
    .loader { flex: 2; min-width: 120px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .subject-cell { display: flex; flex-direction: column; gap: 0.15em; }
    .reporter { display: inline-flex; align-items: center; gap: 0.45em; margin-top: 0.25em; font-size: 0.88em; font-weight: 600; }
    .action-cell mat-form-field { min-width: 180px; margin-right: 0.5em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .empty { color: var(--ms-text-muted); }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .pager { display: flex; align-items: center; gap: 1em; }
    button { min-height: 44px; }
  `],
})
export class AdminTicketsComponent implements OnInit {
  private readonly tickets = inject(AdminTicketsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = STATUSES;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly rows = signal<AdminTicket[]>([]);
  protected readonly total = signal(0);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected readonly status = signal('');
  protected readonly query = signal('');
  protected readonly actingId = signal<string | null>(null);
  protected readonly openId = signal<string | null>(null);
  protected readonly moveTo = signal<TicketStatus>('in-progress');
  protected readonly note = signal('');

  protected readonly displayedColumns = ['subject', 'status', 'action'];

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tickets
      .inbox({ status: this.status() || undefined, q: this.query(), limit: this.limit(), skip: this.skip() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.total.set(res.data?.total ?? 0);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected page(direction: 1 | -1): void {
    this.skip.set(Math.max(0, this.skip() + direction * this.limit()));
    this.reload();
  }

  protected statusClass(status: TicketStatus): string {
    if (status === 'resolved') return 'dp-status dp-status--ok';
    if (status === 'in-progress') return 'dp-status dp-status--info';
    if (status === 'closed') return 'dp-status dp-status--neutral';
    return 'dp-status dp-status--warn';
  }

  protected shortId(id: string): string {
    return id?.length > 10 ? `…${id.slice(-6)}` : (id ?? '—');
  }

  /**
   * Refresh from the server after every decision so the table always
   * shows database truth (including filter-correct placement), never a
   * locally patched row that could drift from what was saved.
   */

  protected openMember(partnerId: string | null | undefined): void {
    if (!partnerId) return;
    void this.router.navigate(['/members', partnerId]);
  }

  protected openWork(row: AdminTicket): void {
    this.openId.set(row.id);
    this.moveTo.set(row.status === 'open' ? 'in-progress' : row.status);
    this.note.set(row.resolutionNote ?? '');
    this.notice.set(null);
  }

  protected assignMe(row: AdminTicket): void {
    const me = this.auth.currentUser()?.id;
    if (!me) {
      this.error.set('Could not determine your account — reload and try again.');
      return;
    }
    this.actingId.set(row.id);
    this.notice.set(null);
    this.tickets
      .decide(row.id, { assigneeId: me, ...(row.status === 'open' ? { status: 'in-progress' as TicketStatus } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.notice.set('Ticket assigned to you.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected save(row: AdminTicket): void {
    this.actingId.set(row.id);
    this.notice.set(null);
    this.error.set(null);
    this.tickets
      .decide(row.id, { status: this.moveTo(), note: this.note().trim() || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.actingId.set(null);
          this.openId.set(null);
          this.notice.set(`Ticket marked ${res.data?.status ?? 'updated'} — requester notified in-app.`);
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }

  protected reopen(row: AdminTicket): void {
    this.actingId.set(row.id);
    this.tickets
      .decide(row.id, { status: 'in-progress', reopen: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actingId.set(null);
          this.openId.set(null);
          this.notice.set('Ticket reopened.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.actingId.set(null);
          this.error.set(err.message);
        },
      });
  }
}
