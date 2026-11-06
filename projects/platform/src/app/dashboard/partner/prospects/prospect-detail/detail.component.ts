import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { ProspectService } from '../prospects.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { CollectCodeComponent } from '../../contacts/manage/details/collect-code.component';
import { MatDialog } from '@angular/material/dialog';
import { nextStage,
ProspectCommunication, ProspectDetail, StageHistoryEntry, STAGE_META, STAGE_TONE, ProspectStage } from
'../lead-pipeline/lead.models';
import { formatStuckDuration } from '../stuck-duration';
import { ApiError } from '../../../../core/http/api-error';

const COMM_TYPES = ['call', 'email', 'text', 'zoom', 'whatsapp', 'presentation'] as const;
const INTEREST_LEVELS = ['hot', 'warm', 'cold'] as const;
const COMM_OUTCOMES = ['Connected', 'No answer', 'Booked session', 'Follow-up set', 'Closed-lost'] as const;
type CommOutcome = (typeof COMM_OUTCOMES)[number];

/** Merge the date-picker day with the time-picker clock into one timestamp. */
const combineDateAndTime = (day: Date | null, clock: Date | null): string => {
  const d = day instanceof Date && !Number.isNaN(day.getTime()) ? new Date(day) : new Date();
  const t = clock instanceof Date && !Number.isNaN(clock.getTime()) ? clock : new Date();
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d.toISOString();
};

interface LinkedSession {
  id: string;
  status: string;
  consultDate?: string;
  consultTime?: string;
  reason?: string;
  contactMethod?: string;
  description?: string;
  username?: string;
  reminded24hAt?: string | null;
  reminded1hAt?: string | null;
}

const normalizeSessionPhone = (value: unknown): string => {
  const raw = String(value ?? '').trim().replace(/[\s\-().]/g, '');
  if (raw.startsWith('+234')) return '0' + raw.slice(4);
  if (raw.startsWith('234') && raw.length > 10) return '0' + raw.slice(3);
  return raw;
};

const sessionPhonesMatch = (a: unknown, b: unknown): boolean => {
  const x = normalizeSessionPhone(a);
  const y = normalizeSessionPhone(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const tail = (s: string): string => s.replace(/\D/g, '').slice(-9);
  const tx = tail(x);
  const ty = tail(y);
  return tx.length >= 7 && tx === ty;
};

/**
 * @title Prospect detail — bio, conversion journey, activity timeline.
 *
 * Single place to work a prospect: advance stage, log every touch,
 * convert with confidence. OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-prospect-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProspectService],
  imports: [
    DatePipe, MatButtonModule, MatChipsModule, MatDatepickerModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, MatTimepickerModule, ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="../board">Pipeline</a> &gt;
        <span>{{ names() }}</span>
      </div>
    </section>

    <section class="detail-page">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <p class="error" role="alert">
          {{ err }}
          <button mat-button (click)="reload()">Retry</button>
        </p>
      }

      @if (convertedNotice(); as converted) {
        <div class="code-banner" role="status">
          <mat-icon>celebration</mat-icon>
          <div>
            <strong>{{ converted.name }}</strong> is marked converted. Share your open registration or referral link
            so they can join.
          </div>
          <button mat-icon-button (click)="convertedNotice.set(null)" aria-label="Dismiss">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (lead(); as prospect) {
        <div class="detail-head">
          <div>
            <h2>{{ names() }}</h2>
            <p class="subtitle">
              {{ prospect.prospectPhone }} · {{ prospect.prospectEmail || 'no email' }} ·
              via {{ prospect.prospectSource }}
            </p>
          </div>
          <span class="dp-status {{ stageTone() }}">{{ chip().label }}</span>
        </div>

        @if (isDownline()) {
          <div class="downline-banner" role="note">
            <mat-icon>support_agent</mat-icon>
            <div>
              <strong>Downline prospect — you're supporting this contact.</strong>
              <span class="muted"> Log activity, book sessions and advance the stage on their behalf. Enrolment credit stays with the owner.</span>
            </div>
          </div>
        }

        <div class="journey dp-card">
          <div><strong>Journey:</strong> joined {{ prospect.createdAt | date:'mediumDate' }}</div>
          <div [title]="daysInStage() + ' days in current stage'">{{ stuckDuration(daysInStage()) }} in current stage</div>
          <div>{{ touchCount() }} logged touches</div>
        </div>

        <div class="dp-card context-card" aria-label="Contact context">
          <div class="context-head">
            <strong>Contact context</strong>
            <a mat-button [routerLink]="['../edit', prospectId()]">Edit contact</a>
          </div>
          <dl class="facts">
            <div><dt>Relationship</dt><dd>{{ prospect.relationship || '—' }}</dd></div>
            <div><dt>Priority</dt><dd>{{ prospect.priority || '—' }}</dd></div>
            <div><dt>Best time to call</dt><dd>{{ prospect.bestTimeToCall || '—' }}</dd></div>
            <div><dt>Agreed to be contacted</dt><dd>{{ prospect.consentToContact ? 'Yes' : 'No' }}</dd></div>
            <div><dt>Source</dt><dd>{{ prospect.prospectSource || '—' }}</dd></div>
          </dl>
          @if (prospect.notes) {
            <p class="notes">{{ prospect.notes }}</p>
          } @else {
            <p class="muted">No notes yet — add context from Edit contact so your upline sees it here.</p>
          }
        </div>

        <div class="detail-actions">
          @if (next(); as nxt) {
            <button mat-flat-button color="primary" (click)="advance(nxt)" [disabled]="acting()">
              Advance to {{ nxt }}
            </button>
          }
          @if (canClose()) {
            <button mat-button (click)="advance('Closed')" [disabled]="acting()">Mark lost</button>
          }
          @if (canConvert()) {
            @if (confirming()) {
              <button mat-flat-button color="accent" (click)="convert()" [disabled]="acting()">Confirm convert?</button>
              <button mat-button (click)="confirming.set(false)">Cancel</button>
            } @else {
              <button mat-flat-button color="accent" (click)="confirming.set(true)">Convert</button>
            }
          }
          @if (isConverted()) {
            <span class="muted">Enrolled ✓</span>
          }
          <a mat-icon-button [routerLink]="['/dashboard/prospects/edit', prospectId()]" title="Edit prospect" aria-label="Edit prospect">
            <mat-icon>edit</mat-icon>
          </a>
          @if (!isConverted()) {
            <a mat-button [routerLink]="['/dashboard/prospects/booking', prospectId()]" title="Book a chat">Book session</a>
          }
          <a mat-button [routerLink]="['/dashboard/prospects/kits']" [queryParams]="{ for: prospectId(), forName: names() }" title="Present a deck to this prospect">Present a deck</a>
          <button mat-button (click)="toggleLogForm()">{{ showLogForm() ? 'Cancel' : 'Log activity' }}</button>
        </div>

        @if (showLogForm()) {
          <form class="log-form dp-card" [formGroup]="logForm" (ngSubmit)="saveLog()">
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>Type</mat-label>
                <mat-select formControlName="type">
                  @for (t of commTypes; track t) {
                    <mat-option [value]="t">{{ t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Interest</mat-label>
                <mat-select formControlName="interestLevel">
                  @for (level of interestLevels; track level) {
                    <mat-option [value]="level">{{ level }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <div>
              <span class="field-label" id="outcome-label">Outcome</span>
              <div class="seg" role="radiogroup" aria-labelledby="outcome-label">
                @for (o of commOutcomes; track o) {
                  <button
                    type="button"
                    class="seg-btn"
                    [class.seg-btn--active]="logForm.get('outcome')?.value === o"
                    [attr.aria-pressed]="logForm.get('outcome')?.value === o"
                    (click)="pickOutcome(o)"
                  >{{ o }}</button>
                }
              </div>
            </div>
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>Date</mat-label>
                <input matInput [matDatepicker]="logDatePicker" formControlName="date" />
                <mat-datepicker-toggle matSuffix [for]="logDatePicker" />
                <mat-datepicker #logDatePicker />
                @if (logForm.get('date')?.hasError('required') && logForm.get('date')?.touched) {
                  <mat-error>Date is required</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Time</mat-label>
                <input matInput [matTimepicker]="logTimePicker" formControlName="time" />
                <mat-timepicker-toggle matSuffix [for]="logTimePicker" />
                <mat-timepicker #logTimePicker interval="30m" />
                @if (logForm.get('time')?.hasError('required') && logForm.get('time')?.touched) {
                  <mat-error>Time is required</mat-error>
                }
              </mat-form-field>
            </div>
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>Duration (min)</mat-label>
                <input matInput type="number" min="0" formControlName="duration" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Follow up by</mat-label>
                <input matInput [matDatepicker]="followUpPicker" formControlName="followUpDate" placeholder="Pick a date" />
                <mat-datepicker-toggle matSuffix [for]="followUpPicker" />
                <mat-datepicker #followUpPicker />
                @if (logForm.get('followUpDate')?.hasError('required') && logForm.get('followUpDate')?.touched) {
                  <mat-error>Pick when to follow up (not needed for Closed-lost).</mat-error>
                }
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>What happened?</mat-label>
              <textarea matInput rows="3" formControlName="description" maxlength="5000"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Next action</mat-label>
              <input matInput formControlName="followUpAction" maxlength="500" placeholder="e.g. Call Thursday with pricing" />
            </mat-form-field>
            <div class="form-actions">
              <button mat-raised-button color="primary" type="submit" [disabled]="logForm.invalid || logging()">
                {{ logging() ? 'Saving…' : 'Save activity' }}
              </button>
              @if (showHotNudge()) {
                <a mat-button [routerLink]="['../booking', prospectId()]">Next best move: Book session →</a>
              }
              @if (logError(); as err) {
                <span class="error" role="alert">{{ err }}</span>
              }
            </div>
          </form>
        }

        <h3>Sessions ({{ sessions().length }})</h3>
        @if (sessionsLoading()) {
          <mat-progress-bar mode="indeterminate" aria-label="Loading" />
        } @else if (sessions().length > 0) {
          <ol class="session-list">
            @for (s of sessions(); track s.id || $index) {
              <li class="dp-card session-item">
                <div class="session-top">
                  <strong>{{ s.consultDate | date: 'mediumDate' }}@if (s.consultTime) { · {{ s.consultTime }}}</strong>
                  <span class="dp-status {{ sessionStatusClass(s.status) }}">{{ s.status }}</span>
                  @if (s.reminded1hAt || s.reminded24hAt) {
                    <span class="dp-status dp-status--ok" title="Reminder sent for this session">Reminded</span>
                  }
                </div>
                @if (s.reason) {
                  <p class="muted">{{ s.reason }}@if (s.contactMethod) { · via {{ s.contactMethod }}}</p>
                }
                @if (s.description) {
                  <p>{{ s.description }}</p>
                }
                @if (s.username) {
                  <p class="muted">Booked by @{{ s.username }}
                    @if (myUsername() && s.username === myUsername()) {
                      <span class="dp-status dp-status--info">You</span>
                    } @else {
                      <span class="dp-status dp-status--warn">Support</span>
                    }
                  </p>
                }
              </li>
            }
          </ol>
        } @else {
          <p class="empty">No booked sessions for this prospect yet.</p>
        }

        <h3>Activity timeline ({{ timeline().length }})</h3>
        @if (timeline().length > 0) {
          <ol class="timeline">
            @for (row of timeline(); track (row.kind === 'comm' ? (row.comm.id ?? row.comm.date) : (row.move.id ?? row.move.at)) ?? $index) {
              @if (row.kind === 'comm') {
              <li class="timeline-item dp-card">
                <mat-icon>{{ commIcon(row.comm.type) }}</mat-icon>
                <div class="timeline-body">
                  <div class="timeline-top">
                    <strong>{{ row.comm.type }}</strong>
                    @if (row.comm.interestLevel) {
                      <span class="dp-status dp-status--info">{{ row.comm.interestLevel }}</span>
                    }
                    @if (row.comm.outcome) {
                      <span class="dp-status {{ outcomeClass(row.comm.outcome) }}">{{ row.comm.outcome }}</span>
                    }
                    @if (authorLabel(row.comm, prospect.partnerId); as by) {
                      <span class="dp-status {{ authorClass(row.comm, prospect.partnerId) }}">{{ by }}</span>
                    }
                    <span class="muted">{{ row.comm.date | date:'medium' }}</span>
                  </div>
                  @if (row.comm.description) {
                    <p>{{ row.comm.description }}</p>
                  }
                  @if (row.comm.followUpAction || row.comm.followUpDate) {
                    <p class="muted">
                      Next: {{ row.comm.followUpAction || '—' }}@if (row.comm.followUpDate) { · by {{ row.comm.followUpDate | date:'mediumDate' }}}
                      @if (followUpOverdue(row.comm)) {
                        <span class="dp-status dp-status--warn">Overdue</span>
                      }
                    </p>
                  }
                </div>
              </li>
              } @else {
              <li class="timeline-item timeline-item--stage dp-card">
                <mat-icon>trending_up</mat-icon>
                <div class="timeline-body">
                  <div class="timeline-top">
                    <strong>Stage: {{ row.move.from || 'New' }} → {{ row.move.to }}</strong>
                    @if (stageAuthorLabel(row.move, prospect.partnerId); as by) {
                      <span class="dp-status {{ stageAuthorClass(row.move, prospect.partnerId) }}">{{ by }}</span>
                    }
                    <span class="muted">{{ row.move.at | date:'medium' }}</span>
                  </div>
                </div>
              </li>
              }
            }
          </ol>
        } @else {
          <p class="empty">No touches logged yet — log the first one above.</p>
        }
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .detail-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .detail-page h3 { margin: 0.5em 0 0; }
    .detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
    .detail-head h2 { margin: 0; text-transform: capitalize; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .journey { display: flex; gap: 1.5em; flex-wrap: wrap; padding: 0.8em 1em; font-size: 0.9em; }
    .downline-banner { display: flex; align-items: flex-start; gap: 0.6em; background: var(--ms-info-soft); border: 1px solid var(--ms-info); border-radius: 8px; padding: 0.75em 1em; font-size: 0.9em; }
    html[data-theme='dark'] .downline-banner { color: #90caf9; }
    .downline-banner mat-icon { flex: none; }
    .downline-banner div { flex: 1; }
    .context-card { padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .context-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6em; flex-wrap: wrap; }
    .context-head a { min-height: 44px; }
    .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5em 1em; margin: 0; }
    .facts div { min-width: 0; }
    .facts dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
    .facts dd { margin: 0; font-size: 0.9rem; overflow-wrap: anywhere; text-transform: capitalize; }
    .notes { margin: 0; font-size: 0.9rem; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.6em 0.8em; }
    @media only screen and (max-width: 600px) {
      .facts { grid-template-columns: 1fr 1fr; }
    }
    .detail-actions { display: flex; gap: 0.4em; flex-wrap: wrap; align-items: center; }
    .log-form { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .field-label { font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4em; }
    .seg { display: flex; gap: 0.5em; flex-wrap: wrap; }
    .seg-btn { display: inline-flex; align-items: center; gap: 0.35em; border: 1px solid var(--ms-line); border-radius: 999px; padding: 0.55em 1em; min-height: 44px; background: transparent; cursor: pointer; color: inherit; font: inherit; font-size: 0.9rem; }
    .seg-btn--active { border: 2px solid var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
    @media only screen and (max-width: 600px) {
      .two-col { grid-template-columns: 1fr; }
    }
    .form-actions { display: flex; align-items: center; gap: 0.75em; }
    .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .timeline-item { display: flex; gap: 0.8em; padding: 0.8em 1em; }
    .timeline-item mat-icon { color: var(--ms-primary-strong); }
    .timeline-item--stage { border-left: 4px solid var(--ms-info); }
    .session-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .session-item { padding: 0.8em 1em; display: flex; flex-direction: column; gap: 0.25em; }
    .session-item p { margin: 0; }
    .session-top { display: flex; align-items: center; justify-content: space-between; gap: 0.6em; flex-wrap: wrap; }
    .timeline-body { flex: 1; display: flex; flex-direction: column; gap: 0.25em; }
    .timeline-body p { margin: 0; }
    .timeline-top { display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap; text-transform: capitalize; }
    .code-banner { display: flex; align-items: center; gap: 0.75em; background: var(--ms-success-soft); border: 1px solid var(--ms-success); border-radius: 8px; padding: 0.75em 1em; }
    .code-banner code { font-size: 1.2em; font-weight: 700; letter-spacing: 0.1em; background: var(--ms-surface); padding: 0.1em 0.5em; border-radius: 4px; }
    .code-banner div { flex: 1; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class ProspectDetailComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
  private readonly bookings = inject(ProspectService, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly routes = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly logging = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly logError = signal<string | null>(null);
  protected readonly lead = signal<ProspectDetail | null>(null);
  protected readonly confirming = signal(false);
  protected readonly convertedNotice = signal<{ name: string } | null>(null);
  protected readonly showLogForm = signal(false);
  protected readonly sessions = signal<LinkedSession[]>([]);
  protected readonly sessionsLoading = signal(false);

  protected readonly commTypes = [...COMM_TYPES];
  protected readonly interestLevels = [...INTEREST_LEVELS];
  protected readonly commOutcomes = [...COMM_OUTCOMES];

  protected readonly logForm = this.fb.nonNullable.group({
    type: ['call' as (typeof COMM_TYPES)[number], Validators.required],
    interestLevel: ['warm' as (typeof INTEREST_LEVELS)[number], Validators.required],
    outcome: ['Connected' as CommOutcome, Validators.required],
    date: [new Date() as Date | null, Validators.required],
    time: [new Date() as Date | null, Validators.required],
    duration: [0, [Validators.required, Validators.min(0)]],
    description: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(5000)]],
    followUpAction: [''],
    followUpDate: [null as Date | null],
  });

  protected readonly timeline = computed<Array<{ kind: 'comm'; comm: ProspectCommunication } | { kind: 'stage'; move: StageHistoryEntry }>>(() => {
    const lead = this.lead();
    const rows: Array<{ kind: 'comm'; comm: ProspectCommunication } | { kind: 'stage'; move: StageHistoryEntry }> = [
      ...((lead?.communications ?? []) as ProspectCommunication[]).map((comm) => ({ kind: 'comm' as const, comm })),
      ...((lead?.stageHistory ?? []) as StageHistoryEntry[]).map((move) => ({ kind: 'stage' as const, move })),
    ];
    const at = (r: (typeof rows)[number]): number =>
      new Date(r.kind === 'comm' ? (r.comm.date ?? 0) : (r.move.at ?? 0)).getTime();
    rows.sort((a, b) => at(b) - at(a));
    return rows;
  });

  protected readonly touchCount = computed(() => this.lead()?.communications?.length ?? 0);

  protected readonly chip = computed(() => {
    const stage = (this.lead()?.status?.stage ?? 'New') as ProspectStage;
    return STAGE_META[stage] ?? STAGE_META.New;
  });

  protected readonly stageTone = computed(() => {
    const stage = (this.lead()?.status?.stage ?? 'New') as ProspectStage;
    return STAGE_TONE[stage] ?? STAGE_TONE.New;
  });

  protected readonly next = computed(() => {
    const next = nextStage(this.lead()?.status?.stage);
    // Conversion has its own confirm dialog, never a one-click stage move.
    return next === 'Converted' ? null : next;
  });

  /** Upline support view: the prospect belongs to someone else in your downline. */
  protected readonly isDownline = computed(() => {
    const owner = this.lead()?.partnerId;
    const me = this.auth.currentUser()?.id;
    return !!owner && !!me && String(owner) !== String(me);
  });

  protected readonly daysInStage = computed(() => {
    const s = this.lead()?.status;
    const raw = s?.stageEnteredAt ?? this.lead()?.updatedAt ?? this.lead()?.createdAt;
    if (!raw) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(raw).getTime()) / 86400000));
  });

  protected readonly stuckDuration = formatStuckDuration;

  ngOnInit(): void {
    this.routes.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (id) this.load(id);
      });
  }

  protected prospectId(): string {
    return this.routes.snapshot.paramMap.get('id') ?? '';
  }

  protected names(): string {
    const lead = this.lead();
    if (!lead) return 'Prospect';
    return this.leads.prospectName(lead);
  }

  protected canConvert(): boolean {
    const stage = this.lead()?.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }

  protected canClose(): boolean {
    const stage = this.lead()?.status?.stage ?? 'New';
    return stage !== 'Converted' && stage !== 'Closed';
  }

  protected isConverted(): boolean {
    return this.lead()?.status?.stage === 'Converted';
  }

  protected commIcon(type: string | undefined): string {
    switch (type) {
      case 'call': return 'call';
      case 'email': return 'email';
      case 'text': return 'sms';
      case 'zoom': return 'videocam';
      case 'whatsapp': return 'chat';
      default: return 'event_note';
    }
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const prospect = res.data ?? null;
          this.lead.set(prospect);
          this.loading.set(false);
          if (prospect) this.loadSessions(prospect);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  /**
   * Linked sessions: bookings carry no prospectId, so match by normalized
   * phone within this prospect's partner bookings. Fail-soft — a sessions
   * failure never breaks the detail page.
   */
  private loadSessions(prospect: ProspectDetail): void {
    const partnerId = (prospect as { partnerId?: unknown }).partnerId;
    const phone = prospect.prospectPhone;
    if (!partnerId || !phone || !this.bookings) {
      this.sessions.set([]);
      return;
    }
    this.sessionsLoading.set(true);
    this.bookings.getSessionBookingsFor(String(partnerId)).subscribe({
      next: (res: { data?: unknown[] }) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        const matched: LinkedSession[] = (rows as Array<Record<string, unknown>>)
          .filter((r) => sessionPhonesMatch(r['phone'], phone))
          .map((r) => ({
            id: String(r['_id'] ?? r['id'] ?? ''),
            status: typeof r['status'] === 'string' ? (r['status'] as string) : 'Scheduled',
            consultDate: r['consultDate'] != null ? String(r['consultDate']) : undefined,
            consultTime: typeof r['consultTime'] === 'string' ? (r['consultTime'] as string) : undefined,
            reason: typeof r['reason'] === 'string' ? (r['reason'] as string) : undefined,
            contactMethod: typeof r['contactMethod'] === 'string' ? (r['contactMethod'] as string) : undefined,
            description: typeof r['description'] === 'string' ? (r['description'] as string) : undefined,
            username: typeof r['username'] === 'string' ? (r['username'] as string) : undefined,
            reminded24hAt: typeof r['reminded24hAt'] === 'string' ? (r['reminded24hAt'] as string) : undefined,
            reminded1hAt: typeof r['reminded1hAt'] === 'string' ? (r['reminded1hAt'] as string) : undefined,
          }))
          .sort((a, b) => new Date(b.consultDate ?? 0).getTime() - new Date(a.consultDate ?? 0).getTime());
        this.sessions.set(matched);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessions.set([]);
        this.sessionsLoading.set(false);
      },
    });
  }

  protected sessionStatusClass(status: string): string {
    switch (status) {
      case 'Completed':
        return 'dp-status--ok';
      case 'Scheduled':
      case 'In Progress':
      case 'Rebooked':
        return 'dp-status--info';
      case 'Cancelled':
      case 'Incomplete':
        return 'dp-status--bad';
      default:
        return 'dp-status--warn';
    }
  }

  protected reload(): void {
    const id = this.prospectId();
    if (id) this.load(id);
  }

  protected toggleLogForm(): void {
    this.showLogForm.set(!this.showLogForm());
    this.logError.set(null);
    if (this.showLogForm()) this.applyFollowUpValidators();
  }

  protected pickOutcome(o: CommOutcome): void {
    this.logForm.get('outcome')?.setValue(o);
    this.logForm.get('outcome')?.markAsTouched();
    this.applyFollowUpValidators();
  }

  /** Follow-up date is required unless the touch closed the prospect. */
  private applyFollowUpValidators(): void {
    const fud = this.logForm.get('followUpDate');
    if (this.logForm.get('outcome')?.value === 'Closed-lost') fud?.setValidators([]);
    else fud?.setValidators([Validators.required]);
    fud?.updateValueAndValidity({ emitEvent: false });
  }

  /** Hot + still open → point at the booking action inline. */
  protected showHotNudge(): boolean {
    return this.logForm.get('interestLevel')?.value === 'hot'
      && this.logForm.get('outcome')?.value !== 'Closed-lost'
      && !this.isConverted();
  }

  protected outcomeClass(outcome: string | undefined): string {
    switch (outcome) {
      case 'Booked session':
      case 'Connected':
        return 'dp-status--ok';
      case 'Follow-up set':
        return 'dp-status--info';
      case 'Closed-lost':
        return 'dp-status--bad';
      default:
        return 'dp-status--warn';
    }
  }

  protected followUpOverdue(comm: { followUpDate?: string; status?: string }): boolean {
    if (!comm?.followUpDate || comm?.status === 'Closed') return false;
    const due = new Date(comm.followUpDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }

  /** Author pill: your own touches vs the owner's vs supporting upline. */
  protected authorLabel(
    comm: { createdBy?: string; createdByName?: string },
    ownerId: unknown,
  ): string | null {
    const author = comm?.createdBy ? String(comm.createdBy) : '';
    if (!author) return null;
    const me = this.auth.currentUser()?.id ? String(this.auth.currentUser()?.id) : '';
    const name = comm?.createdByName ? String(comm.createdByName) : '';
    if (me && author === me) return 'You';
    if (ownerId && author === String(ownerId)) return name ? `Owner · ${name}` : 'Owner';
    return name ? `Support · ${name}` : 'Support';
  }

  protected authorClass(
    comm: { createdBy?: string },
    ownerId: unknown,
  ): string {
    const author = comm?.createdBy ? String(comm.createdBy) : '';
    const me = this.auth.currentUser()?.id ? String(this.auth.currentUser()?.id) : '';
    if (me && author === me) return 'dp-status--info';
    if (ownerId && author === String(ownerId)) return 'dp-status--ok';
    return 'dp-status--warn';
  }

  protected myUsername(): string {
    const u = this.auth.currentUser()?.username;
    return u ? String(u) : '';
  }

  /** Current actor for signed writes (stage moves, conversions). */
  private actor(): { by?: string; byName?: string } {
    const me = this.auth.currentUser();
    const name = [me?.name, me?.surname].filter(Boolean).join(' ') || String(me?.username ?? '');
    return {
      ...(me?.id ? { by: String(me.id) } : {}),
      ...(name ? { byName: name } : {}),
    };
  }

  /** Stage-move author pill reuses the comm rule (by/byName shape). */
  protected stageAuthorLabel(move: StageHistoryEntry, ownerId: unknown): string | null {
    return this.authorLabel({ createdBy: move.by, createdByName: move.byName }, ownerId);
  }

  protected stageAuthorClass(move: StageHistoryEntry, ownerId: unknown): string {
    return this.authorClass({ createdBy: move.by }, ownerId);
  }

  protected advance(stage: ProspectStage): void {
    const id = this.prospectId();
    if (!id) return;
    this.acting.set(true);
    this.leads
      .advanceStage(id, stage, this.actor())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected convert(): void {
    const id = this.prospectId();
    const lead = this.lead();
    if (!id) return;
    this.confirming.set(false);
    this.dialog.open(CollectCodeComponent, {
      data: {
        _id: (lead as { _id?: string } | null)?._id ?? id,
        prospectName: (lead as { prospectName?: string } | null)?.prospectName ?? '',
        prospectSurname: (lead as { prospectSurname?: string } | null)?.prospectSurname ?? '',
      },
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: any) => {
        if (res?.converted) {
          this.convertedNotice.set({ name: this.names() });
          this.reload();
        }
      });
  }

  protected saveLog(): void {
    this.applyFollowUpValidators();
    if (this.logForm.invalid) return;
    const id = this.prospectId();
    if (!id) return;
    this.logging.set(true);
    this.logError.set(null);
    const v = this.logForm.getRawValue();
    const outcome = v.outcome as CommOutcome;
    const me = this.auth.currentUser();
    const authorName = [me?.name, me?.surname].filter(Boolean).join(' ') || String(me?.username ?? '');
    this.leads
      .logCommunication(id, {
        type: v.type,
        interestLevel: v.interestLevel,
        date: combineDateAndTime(v.date, v.time),
        duration: Number(v.duration),
        description: v.description.trim(),
        followUpAction: v.followUpAction.trim(),
        outcome,
        followUpDate: v.followUpDate instanceof Date && !Number.isNaN(v.followUpDate.getTime())
          ? v.followUpDate.toISOString().slice(0, 10)
          : undefined,
        status: outcome === 'Closed-lost' ? 'Closed' : 'Open',
        ...(me?.id ? { createdBy: String(me.id) } : {}),
        ...(authorName ? { createdByName: authorName } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.logging.set(false);
          this.showLogForm.set(false);
          this.logForm.patchValue({ date: new Date(), time: new Date(), duration: 0, description: '', followUpAction: '', outcome: 'Connected' as CommOutcome, followUpDate: null });
          this.reload();
        },
        error: (err: ApiError) => {
          this.logging.set(false);
          this.logError.set(err.message);
        },
      });
  }
}
