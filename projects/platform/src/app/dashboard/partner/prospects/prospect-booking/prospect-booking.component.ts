import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { ProspectListInterface, ProspectService } from '../prospects.service';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { BookingStatusUpdateComponent } from './prospect-status-update.component';
import { ApiError } from '../../../../core/http/api-error';

const NEEDS_OUTCOME = ['Scheduled', 'In Progress', 'Rebooked'];

/** Phone keys for owner-vs-downline matching (full normalized + last-9 tail). */
const phoneKeys = (value: unknown): string[] => {
  const raw = String(value ?? '').trim().replace(/[\s\-().]/g, '');
  if (!raw) return [];
  const full = raw.startsWith('+234') ? '0' + raw.slice(4) : raw.startsWith('234') && raw.length > 10 ? '0' + raw.slice(3) : raw;
  const tail = full.replace(/\D/g, '').slice(-9);
  return [...new Set([full, tail])].filter((k) => k.length >= 7);
};

interface BookingSession {
  _id?: string;
  id?: string;
  name?: string;
  surname?: string;
  phone?: string;
  email?: string;
  status?: string;
  consultDate?: string;
  consultTime?: string;
  createdAt?: string;
  reminded24hAt?: string | null;
  reminded1hAt?: string | null;
}

const STATUS_TONE: Record<string, string> = {
  Scheduled: 'dp-status--info',
  Completed: 'dp-status--ok',
  'No Show from Prospect': 'dp-status--warn',
  'No Show from Partner': 'dp-status--warn',
  Incomplete: 'dp-status--bad',
  Rebooked: 'dp-status--purple',
  'In Progress': 'dp-status--purple',
  Cancelled: 'dp-status--neutral',
};

/**
 * @title My sessions — booked prospect conversations.
 *
 * Every booked chat in one place with outcome tracking: sessions that
 * already happened but still read Scheduled are surfaced first so the
 * member records what happened — that record is what moves deals.
 * OnPush + signals, fully typed against the legacy booking shape.
 */
@Component({
  selector: 'async-prospect-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, PageSkeletonComponent, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Prospects</a> &gt;
        <span>My sessions</span>
      </div>
    </section>

    <section class="sessions-page">
      <div class="page-head">
        <div>
          <h2>My sessions</h2>
          <p class="subtitle">Booked conversations move deals — record what happened after each one.</p>
        </div>
        <a mat-button routerLink="/dashboard/prospects/pipeline">Pick someone to book</a>
      </div>

      @if (loading()) {
        <async-page-skeleton layout="list" [rows]="4" label="your sessions" [showHeader]="false" />
      } @else {
      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (needsOutcome() > 0) {
        <p class="attention" role="status">
          <mat-icon>event_busy</mat-icon>
          {{ needsOutcome() }} past session{{ needsOutcome() === 1 ? '' : 's' }} still {{ needsOutcome() === 1 ? 'reads' : 'read' }} scheduled — record the outcome below.
        </p>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Filter by name</mat-label>
          <input matInput type="search" [value]="filterText()" (input)="filterText.set($any($event.target).value)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Status</mat-label>
          <mat-select [value]="filterStatus()" (selectionChange)="filterStatus.set($event.value)">
            <mat-option [value]="null">All statuses</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="chip-row">
        <mat-chip highlighted>Today: {{ todayCount() }}</mat-chip>
        <mat-chip highlighted>This week: {{ weekCount() }}</mat-chip>
        <mat-chip highlighted>{{ sessions().length }} total</mat-chip>
        @if (downlineCount() > 0) {
          <mat-chip highlighted>Downline: {{ downlineCount() }}</mat-chip>
        }
      </div>

      @if (filtered().length > 0) {
        <ul class="session-list">
          @for (s of filtered(); track s._id ?? s.id ?? $index) {
            <li class="dp-card session" [class.session--attention]="isPastUnresolved(s)">
              <div class="session-top">
                <div>
                  <strong>{{ s.name }} {{ s.surname }}</strong>
                  <a class="phone" [href]="'tel:' + s.phone">{{ s.phone }}</a>
                  <div class="muted">{{ s.consultDate | date:'mediumDate' }} · {{ s.consultTime }}</div>
                </div>
                <div class="badges">
                  @if (downlineOwner(s); as owner) {
                    <span class="dp-status dp-status--warn" [title]="'Prospect belongs to ' + owner.name + ' — outcome mirrors to their timeline'">Partner · {{ owner.name }}</span>
                  } @else if (isDownline(s)) {
                    <span class="dp-status dp-status--warn" title="Prospect belongs to your downline — outcome mirrors to their timeline">Downline</span>
                  }
                  <span class="dp-status {{ statusTone(s.status) }}">{{ s.status || 'Scheduled' }}</span>
                  @if (s.reminded1hAt || s.reminded24hAt) {
                    <span class="dp-status dp-status--ok" title="Reminder sent for this session">Reminded</span>
                  }
                </div>
              </div>
              <div class="session-actions">
                <button mat-button (click)="openSession(s)">Update outcome</button>
              </div>
            </li>
          }
        </ul>
      } @else if (!loading() && !error()) {
        <div class="empty-card">
          <mat-icon>event_available</mat-icon>
          <p>No sessions match — book your first chat from the pipeline and it lands here.</p>
          <a mat-button routerLink="/dashboard/prospects/pipeline">Open pipeline</a>
        </div>
      }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .sessions-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
    .page-head a, .session-actions button, .empty-card a { min-height: 44px; }
    .attention { display: flex; align-items: center; gap: 0.5em; background: var(--ms-warning-soft); border: 1px solid var(--ms-warning); border-radius: 8px; padding: 0.7em 1em; margin: 0; font-size: 0.9em; }
    html[data-theme="dark"] .attention { color: #fcd34d; }
    .attention mat-icon { color: var(--ms-warning); flex: none; }
    html[data-theme="dark"] .attention mat-icon { color: #fcd34d; }
    .toolbar { display: flex; gap: 0.75em; flex-wrap: wrap; align-items: center; }
    .toolbar mat-form-field { flex: 1; min-width: 200px; }
    .loader { flex: 2; min-width: 120px; }
    .chip-row { display: flex; gap: 0.4em; flex-wrap: wrap; }
    .session-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .session { padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.5em; }
    .session--attention { border-left: 4px solid var(--ms-warning); }
    .session-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75em; flex-wrap: wrap; }
    .badges { display: flex; gap: 0.4em; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
    .phone { color: var(--ms-primary-strong); font-weight: 600; text-decoration: none; margin-left: 0.5em; }
    .session-actions { display: flex; gap: 0.4em; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 0.5em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 0.6em; text-align: center; background: var(--ms-surface); border: 1px dashed var(--ms-line); border-radius: 14px; padding: 2.5em 1.5em; color: var(--ms-text-muted); }
    .empty-card mat-icon { font-size: 40px; height: 40px; width: 40px; opacity: 0.6; }
    .empty-card p { margin: 0; max-width: 34em; }
  `],
})
export class ProspectBookingComponent implements OnInit {
  @Input() partner!: PartnerInterface;
  @Input() prospectList!: unknown[];

  private readonly bookings = inject(ProspectService, { optional: true });
  private readonly leads = inject(LeadPipelineService, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sessions = signal<BookingSession[]>([]);
  protected readonly filterText = signal('');
  protected readonly filterStatus = signal<string | null>(null);
  protected readonly ownPhoneKeys = signal<Set<string>>(new Set());
  protected readonly phonesLoaded = signal(false);
  protected readonly downlineOwners = signal<Map<string, { name: string; username: string }>>(new Map());

  protected readonly statuses = ['Scheduled', 'In Progress', 'Rebooked', 'Completed', 'No Show from Prospect', 'No Show from Partner', 'Incomplete', 'Cancelled'];

  protected readonly filtered = computed(() => {
    const q = this.filterText().trim().toLowerCase();
    const status = this.filterStatus();
    return this.sessions().filter((s) => {
      if (status && String(s.status ?? '') !== status) return false;
      if (!q) return true;
      return `${s.name ?? ''} ${s.surname ?? ''} ${s.phone ?? ''}`.toLowerCase().includes(q);
    });
  });

  protected readonly todayCount = computed(() => this.sessions().filter((s) => this.isSameDay(s.consultDate, new Date())).length);
  protected readonly weekCount = computed(() => this.sessions().filter((s) => this.isThisWeek(s.consultDate)).length);
  protected readonly needsOutcome = computed(() => this.sessions().filter((s) => this.isPastUnresolved(s)).length);
  protected readonly downlineCount = computed(() => this.sessions().filter((s) => this.isDownline(s)).length);

  ngOnInit(): void {
    this.sessions.set(this.toSessions(this.prospectList ?? []));
    this.loadOwnPhones();
    this.loadDownlineOwners();
  }

  /** Owner's pipeline phones — a session whose phone isn't yours is downline support. */
  private loadOwnPhones(): void {
    const id = this.partner?._id;
    if (!id || !this.leads) return;
    this.leads
      .listByPartner(id, { limit: 500 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const keys = new Set<string>();
          for (const p of res.data ?? []) {
            for (const k of phoneKeys(p.prospectPhone)) keys.add(k);
          }
          this.ownPhoneKeys.set(keys);
          this.phonesLoaded.set(true);
        },
        error: () => this.phonesLoaded.set(false),
      });
  }

  protected isDownline(s: BookingSession): boolean {
    if (!this.phonesLoaded() || !s?.phone) return false;
    const keys = phoneKeys(s.phone);
    if (keys.length === 0) return false;
    return !keys.some((k) => this.ownPhoneKeys().has(k));
  }

  /** Downline owner lookup — which partner's prospect is this session for. */
  private loadDownlineOwners(): void {
    if (!this.leads) return;
    this.leads
      .downlinePhones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const owners = new Map<string, { name: string; username: string }>();
          for (const item of res.data?.items ?? []) {
            const label = {
              name: item.member?.name ?? 'Team member',
              username: item.member?.username ?? '',
            };
            for (const k of phoneKeys(item.phone)) {
              if (!owners.has(k)) owners.set(k, label);
            }
          }
          this.downlineOwners.set(owners);
        },
        error: () => {},
      });
  }

  protected downlineOwner(s: BookingSession): { name: string; username: string } | null {
    if (!this.isDownline(s) || !s?.phone) return null;
    for (const k of phoneKeys(s.phone)) {
      const hit = this.downlineOwners().get(k);
      if (hit) return hit;
    }
    return null;
  }

  private toSessions(rows: unknown[]): BookingSession[] {
    return (rows as Array<Record<string, unknown>>)
      .map((r) => ({
        _id: typeof r['_id'] === 'string' ? (r['_id'] as string) : undefined,
        id: typeof r['id'] === 'string' ? (r['id'] as string) : undefined,
        name: typeof r['name'] === 'string' ? (r['name'] as string) : '',
        surname: typeof r['surname'] === 'string' ? (r['surname'] as string) : '',
        phone: typeof r['phone'] === 'string' ? (r['phone'] as string) : '',
        email: typeof r['email'] === 'string' ? (r['email'] as string) : '',
        status: typeof r['status'] === 'string' ? (r['status'] as string) : 'Scheduled',
        consultDate: r['consultDate'] != null ? String(r['consultDate']) : undefined,
        reminded24hAt: typeof r['reminded24hAt'] === 'string' ? (r['reminded24hAt'] as string) : undefined,
        reminded1hAt: typeof r['reminded1hAt'] === 'string' ? (r['reminded1hAt'] as string) : undefined,
        consultTime: typeof r['consultTime'] === 'string' ? (r['consultTime'] as string) : '',
        createdAt: r['createdAt'] != null ? String(r['createdAt']) : undefined,
      }))
      .sort(
        (a, b) => new Date(b.consultDate ?? b.createdAt ?? 0).getTime() - new Date(a.consultDate ?? a.createdAt ?? 0).getTime(),
      );
  }

  protected statusTone(status: string | undefined): string {
    return STATUS_TONE[status ?? 'Scheduled'] ?? 'dp-status--neutral';
  }

  protected isPastUnresolved(s: BookingSession): boolean {
    if (!s?.consultDate || !NEEDS_OUTCOME.includes(String(s.status ?? 'Scheduled'))) return false;
    const day = new Date(s.consultDate);
    const today = new Date();
    day.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return day.getTime() < today.getTime();
  }

  private isSameDay(value: unknown, ref: Date): boolean {
    if (!value) return false;
    const d = new Date(value as string);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
  }

  private isThisWeek(value: unknown): boolean {
    if (!value) return false;
    const d = new Date(value as string);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }

  protected openSession(session: BookingSession): void {
    this.dialog.open(BookingStatusUpdateComponent, {
      data: { ...session, _partnerId: this.partner?._id },
      width: '680px',
      maxWidth: '94vw',
      autoFocus: 'dialog',
      restoreFocus: true,
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changed) => {
        if (changed !== false) this.reload();
      });
  }

  protected reload(): void {
    const id = this.partner?._id;
    if (!id || !this.bookings) return;
    this.loading.set(true);
    this.error.set(null);
    this.loadOwnPhones();
    this.loadDownlineOwners();
    this.bookings
      .getSessionBookingsFor(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: { data?: unknown[] }) => {
          this.sessions.set(this.toSessions(res.data ?? []));
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }
}
