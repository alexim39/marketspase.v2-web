import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogModule,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { RouterModule } from '@angular/router';
import { ProspectService } from '../prospects.service';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { toApiError } from '../../../../core/http/api-error';

const normalizePhone = (value: unknown): string => {
  const raw = String(value ?? '').trim().replace(/[\s\-().]/g, '');
  if (raw.startsWith('+234')) return '0' + raw.slice(4);
  if (raw.startsWith('234') && raw.length > 10) return '0' + raw.slice(3);
  return raw;
};

const phonesMatch = (a: unknown, b: unknown): boolean => {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Handle +234 vs 0 prefix and formatting drift — compare last 9 digits.
  const tail = (s: string): string => s.replace(/\D/g, '').slice(-9);
  const tx = tail(x);
  const ty = tail(y);
  return tx.length >= 7 && tx === ty;
};

const commTypeFor = (contactMethod: unknown): 'call' | 'email' | 'text' | 'zoom' | 'whatsapp' => {
  const m = String(contactMethod ?? '').toLowerCase();
  if (m.includes('whatsapp')) return 'whatsapp';
  if (m.includes('video') || m.includes('zoom') || m.includes('meet')) return 'zoom';
  if (m.includes('email')) return 'email';
  if (m.includes('text') || m.includes('sms')) return 'text';
  return 'call';
};

type OutcomeValue =
  | 'Completed'
  | 'No Show from Prospect'
  | 'No Show from Partner'
  | 'Incomplete'
  | 'Rebooked'
  | 'Cancelled'
  | 'Scheduled'
  | 'In Progress';

interface OutcomeOption {
  value: OutcomeValue;
  icon: string;
  hint: string;
  tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral';
}

const PRIMARY_OUTCOMES: OutcomeOption[] = [
  { value: 'Completed', icon: 'check_circle', hint: 'Had the chat — capture the result', tone: 'ok' },
  { value: 'No Show from Prospect', icon: 'event_busy', hint: 'They didn’t join — nudge + rebook', tone: 'warn' },
  { value: 'No Show from Partner', icon: 'person_off', hint: 'You missed it — own it + rebook', tone: 'warn' },
  { value: 'Incomplete', icon: 'pending', hint: 'Started but didn’t finish', tone: 'warn' },
  { value: 'Rebooked', icon: 'event_repeat', hint: 'Move to a new time', tone: 'info' },
  { value: 'Cancelled', icon: 'cancel', hint: 'No further session needed', tone: 'bad' },
];

const KEEP_OPEN: OutcomeOption[] = [
  { value: 'Scheduled', icon: 'schedule', hint: 'Still to happen', tone: 'neutral' },
  { value: 'In Progress', icon: 'autorenew', hint: 'Ongoing conversation', tone: 'neutral' },
];

/**
 * @title Record outcome — what happened in this session.
 *
 * Guided replacement for the flat status dropdown: prospect summary up top,
 * one-tap outcome cards, then only the fields that matter for that outcome.
 * Saves through the legacy `PUT booking/update` contract
 * `{ id, sessionStatus, sessionRemark }` so the list, filters and
 * `needsOutcome` counting keep working. Previous remarks are preserved by
 * appending instead of overwriting. OnPush + signals.
 */
@Component({
  selector: 'async-prospect-response',
  providers: [ProspectService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    RouterModule,
  ],
  template: `
    <h2 mat-dialog-title class="dlg-title">
      <span class="dlg-eyebrow">My sessions · Record outcome</span>
      <span class="dlg-name">{{ displayName() }}</span>
      <span class="dlg-sub">{{ sessionWhen() }}</span>
    </h2>

    <mat-dialog-content class="dlg-content">
      <!-- Prospect summary -->
      <section class="dp-card summary" aria-label="Session summary">
        <div class="summary-top">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <div class="summary-id">
            <strong>{{ displayName() }}</strong>
            <div class="summary-links">
              @if (data?.phone) {
                <a class="phone" [href]="'tel:' + data.phone">{{ data.phone }}</a>
              }
              @if (whatsAppLink()) {
                <a class="wa" [href]="whatsAppLink()" target="_blank" rel="noopener">WhatsApp</a>
              }
            </div>
            @if (data?.email) {
              <div class="muted">{{ data.email }}</div>
            }
          </div>
          <span class="spacer"></span>
          <div class="badges">
            <span class="dp-status" [ngClass]="statusClass(data?.status)">{{ data?.status || 'Scheduled' }}</span>
            <span class="dp-status" [ngClass]="timingClass()">{{ timingLabel() }}</span>
          </div>
        </div>
        <dl class="facts">
          <div><dt>Date</dt><dd>{{ data?.consultDate | date: 'mediumDate' }}</dd></div>
          <div><dt>Time</dt><dd>{{ data?.consultTime || '—' }}</dd></div>
          <div><dt>Reason</dt><dd>{{ data?.reason || '—' }}</dd></div>
          <div><dt>Channel</dt><dd>{{ data?.contactMethod || '—' }}</dd></div>
          <div><dt>Scheduler</dt><dd>{{ data?.referral === 'Booked for prospect' ? 'Booked for prospect' : 'Booked by prospect' }}</dd></div>
          <div><dt>Booked on</dt><dd>{{ data?.createdAt | date: 'mediumDate' }}</dd></div>
        </dl>
        @if (data?.description) {
          <p class="prev"><strong>Previous note:</strong> {{ data.description }}</p>
        }
      </section>

      <!-- Outcome picker -->
      <section aria-label="Outcome">
        <h3 class="sec-title">What happened?</h3>
        <div class="outcome-grid" role="radiogroup" aria-label="Session outcome">
          @for (o of primaryOutcomes; track o.value) {
            <button
              type="button"
              class="outcome"
              [class.outcome--active]="selected() === o.value"
              [attr.aria-pressed]="selected() === o.value"
              (click)="pick(o.value)"
            >
              <mat-icon>{{ o.icon }}</mat-icon>
              <span class="outcome-label">{{ o.value }}</span>
              <span class="muted">{{ o.hint }}</span>
            </button>
          }
        </div>
        <div class="keep-open">
          <span class="muted">Keep open:</span>
          @for (o of keepOpen; track o.value) {
            <button
              type="button"
              class="keep-btn"
              [class.keep-btn--active]="selected() === o.value"
              [attr.aria-pressed]="selected() === o.value"
              (click)="pick(o.value)"
            >
              {{ o.value }}
            </button>
          }
        </div>
        @if (form.get('sessionStatus')?.touched && !selected()) {
          <p class="error" role="alert">Pick one outcome above.</p>
        }
      </section>

      <!-- Conditional detail form -->
      @if (selected()) {
        <form class="detail dp-card" [formGroup]="form" (ngSubmit)="onSubmit()" aria-label="Outcome details">
          @if (needsInterest()) {
            <div>
              <span class="field-label" id="interest-label">How interested are they now?</span>
              <div class="seg" role="radiogroup" aria-labelledby="interest-label">
                @for (level of interestLevels; track level) {
                  <button
                    type="button"
                    class="seg-btn"
                    [class.seg-btn--active]="form.get('interestLevel')?.value === level.value"
                    [attr.aria-pressed]="form.get('interestLevel')?.value === level.value"
                    (click)="form.get('interestLevel')?.setValue(level.value); form.get('interestLevel')?.markAsTouched()"
                  >
                    <mat-icon>{{ level.icon }}</mat-icon>{{ level.label }}
                  </button>
                }
              </div>
              @if (form.get('interestLevel')?.touched && form.get('interestLevel')?.invalid) {
                <p class="error" role="alert">Pick hot, warm or cold.</p>
              }
            </div>
          }

          <mat-form-field appearance="outline">
            <mat-label>{{ remarkLabel() }}</mat-label>
            <textarea
              matInput
              rows="3"
              maxlength="2000"
              formControlName="sessionRemark"
              [placeholder]="remarkPlaceholder()"
            ></textarea>
            @if (form.get('sessionRemark')?.touched && form.get('sessionRemark')?.invalid) {
              <mat-error>Tell us what happened (min 3 characters).</mat-error>
            }
          </mat-form-field>

          @if (needsFollowUp()) {
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>Next action</mat-label>
                <input matInput formControlName="nextAction" maxlength="200" placeholder="e.g. Call Thursday with pricing" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Follow up by (optional)</mat-label>
                <input
                  matInput
                  [matDatepicker]="followUpPicker"
                  formControlName="followUpDate"
                  placeholder="Pick a date"
                  [min]="minFollowUpDate"
                />
                <mat-datepicker-toggle matSuffix [for]="followUpPicker" />
                <mat-datepicker #followUpPicker />
              </mat-form-field>
            </div>
          }

          @if (needsRebook()) {
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>New date</mat-label>
                <input matInput type="date" formControlName="rebookDate" [min]="todayISO()" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>New time</mat-label>
                <input matInput type="time" formControlName="rebookTime" />
              </mat-form-field>
            </div>
            @if (form.get('rebookDate')?.touched && form.get('rebookDate')?.invalid) {
              <p class="error" role="alert">Pick the new date so the rebook is captured in the note.</p>
            }
            <p class="hint">
              Saved into the session note. Then book it properly from the pipeline so it lands back on My sessions.
            </p>
          }

          @if (error(); as err) {
            <p class="error-box" role="alert"><mat-icon>error</mat-icon>{{ err }}</p>
          }

          @if (saved()) {
            <div class="success-box" role="status">
              <mat-icon>check_circle</mat-icon>
              <div>
                <strong>Outcome saved.</strong>
                <span class="muted">The session list refreshes when you close.</span>
                @if (timelineState() === 'syncing') {
                  <p class="muted" role="status">Logging to follow-up timeline…</p>
                } @else if (timelineNote(); as note) {
                  <p class="muted" role="status">{{ note }}</p>
                }
                <div class="success-links">
                  <a mat-button routerLink="/dashboard/prospects/pipeline" (click)="close(true)">Open pipeline</a>
                  @if (timelineProspectId(); as pid) {
                    <a mat-button [routerLink]="['/dashboard/prospects/detail', pid]" (click)="close(true)">View follow-up</a>
                  }
                  @if (data?.phone) {
                    <a mat-button [href]="'tel:' + data.phone">Call back</a>
                  }
                </div>
              </div>
            </div>
          }
        </form>
      }

      <!-- Danger zone -->
      <section class="danger" aria-label="Danger zone">
        @if (!confirmingDelete()) {
          <button mat-button class="danger-btn" (click)="confirmingDelete.set(true)">
            <mat-icon>delete</mat-icon>Delete session…
          </button>
        } @else {
          <div class="danger-confirm dp-card" role="alertdialog" aria-label="Confirm delete">
            <p><strong>Delete this session?</strong> This cannot be undone.</p>
            <div class="danger-actions">
              <button mat-button (click)="confirmingDelete.set(false)" [disabled]="deleting()">Keep</button>
              <button mat-flat-button color="warn" (click)="remove()" [disabled]="deleting()">
                {{ deleting() ? 'Deleting…' : 'Yes, delete' }}
              </button>
            </div>
            @if (error(); as err) {
              <p class="error" role="alert">{{ err }}</p>
            }
          </div>
        }
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dlg-actions">
      <button mat-button (click)="close(false)" [disabled]="saving()">Cancel</button>
      @if (!saved()) {
        <button
          mat-flat-button
          color="primary"
          (click)="onSubmit()"
          [disabled]="!selected() || saving()"
        >
          {{ saving() ? 'Saving…' : 'Save outcome' }}
        </button>
      } @else {
        <button mat-flat-button color="primary" (click)="close(true)">Done</button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dlg-title { display: flex; flex-direction: column; gap: 0.15em; }
      .dlg-eyebrow { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ms-primary-strong); }
      .dlg-name { font-size: 1.25rem; text-transform: capitalize; }
      .dlg-sub { font-size: 0.85rem; color: var(--ms-text-muted); font-weight: 400; }
      .dlg-content { display: flex; flex-direction: column; gap: 1em; padding-top: 0.5em; }
      .summary { padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.7em; }
      .summary-top { display: flex; gap: 0.75em; align-items: flex-start; }
      .avatar { flex: none; width: 44px; height: 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
      .summary-id { min-width: 0; }
      .summary-id strong { text-transform: capitalize; }
      .summary-links { display: flex; gap: 0.6em; align-items: center; flex-wrap: wrap; }
      .phone { color: var(--ms-primary-strong); font-weight: 700; text-decoration: none; }
      .wa { color: var(--ms-success); font-weight: 700; text-decoration: none; font-size: 0.85em; }
      .spacer { flex: 1; }
      .badges { display: flex; gap: 0.4em; flex-wrap: wrap; justify-content: flex-end; }
      .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5em 1em; margin: 0; }
      .facts div { min-width: 0; }
      .facts dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
      .facts dd { margin: 0; font-size: 0.9rem; overflow-wrap: anywhere; }
      .prev { margin: 0; font-size: 0.85rem; background: var(--ms-canvas); border: 1px solid var(--ms-line); border-radius: 8px; padding: 0.6em 0.8em; }
      .sec-title { margin: 0.25em 0 0; font-size: 1rem; }
      .outcome-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6em; margin-top: 0.6em; }
      .outcome { display: flex; flex-direction: column; align-items: flex-start; gap: 0.2em; text-align: left; padding: 0.75em 0.85em; border-radius: 10px; border: 1px solid var(--ms-line); background: var(--ms-surface); cursor: pointer; min-height: 44px; color: inherit; font: inherit; }
      .outcome mat-icon { color: var(--ms-primary-strong); }
      .outcome-label { font-weight: 700; font-size: 0.9rem; }
      .outcome--active { border: 2px solid var(--ms-primary); background: var(--ms-primary-soft); }
      .keep-open { display: flex; align-items: center; gap: 0.5em; flex-wrap: wrap; margin-top: 0.6em; }
      .keep-btn { border: 1px solid var(--ms-line); background: transparent; border-radius: 999px; padding: 0.5em 1em; min-height: 44px; cursor: pointer; color: inherit; font: inherit; font-size: 0.85rem; }
      .keep-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }
      .detail { padding: 1em; display: flex; flex-direction: column; gap: 0.8em; }
      .field-label { font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4em; }
      .seg { display: flex; gap: 0.5em; flex-wrap: wrap; }
      .seg-btn { display: inline-flex; align-items: center; gap: 0.35em; border: 1px solid var(--ms-line); border-radius: 999px; padding: 0.55em 1em; min-height: 44px; background: transparent; cursor: pointer; color: inherit; font: inherit; font-size: 0.9rem; }
      .seg-btn--active { border: 2px solid var(--ms-primary); background: var(--ms-primary-soft); font-weight: 700; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
      .hint { margin: 0; font-size: 0.82rem; color: var(--ms-text-muted); }
      .error { color: var(--ms-error); margin: 0.25em 0 0; font-size: 0.85rem; }
      .error-box, .success-box { display: flex; gap: 0.6em; align-items: flex-start; border-radius: 8px; padding: 0.7em 0.9em; margin: 0; font-size: 0.9rem; }
      .error-box { background: var(--ms-error-soft); color: var(--ms-error); }
      html[data-theme='dark'] .error-box { color: #e89a9a; }
      .success-box { background: var(--ms-success-soft); color: var(--ms-success); }
      html[data-theme='dark'] .success-box { color: #9ccc9f; }
      .success-links { display: flex; gap: 0.4em; flex-wrap: wrap; margin-top: 0.4em; }
      .success-links a { min-height: 44px; }
      .danger { display: flex; justify-content: flex-end; }
      .danger-btn { color: var(--ms-error); min-height: 44px; }
      .danger-confirm { padding: 0.8em 1em; display: flex; flex-direction: column; gap: 0.6em; }
      .danger-confirm p { margin: 0; }
      .danger-actions { display: flex; gap: 0.5em; justify-content: flex-end; }
      .dlg-actions button { min-height: 44px; }
      .muted { color: var(--ms-text-muted); font-size: 0.85em; }
      @media only screen and (max-width: 600px) {
        .outcome-grid { grid-template-columns: 1fr 1fr; }
        .facts { grid-template-columns: 1fr 1fr; }
        .two-col { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class BookingStatusUpdateComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BookingStatusUpdateComponent>);
  readonly data = inject<any>(MAT_DIALOG_DATA);
  private readonly prospects = inject(ProspectService);
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly primaryOutcomes = PRIMARY_OUTCOMES;
  protected readonly keepOpen = KEEP_OPEN;
  protected readonly interestLevels = [
    { value: 'hot', label: 'Hot', icon: 'local_fire_department' },
    { value: 'warm', label: 'Warm', icon: 'thermostat' },
    { value: 'cold', label: 'Cold', icon: 'ac_unit' },
  ];

  protected readonly selected = signal<OutcomeValue | ''>('');
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly minFollowUpDate = new Date();
  protected readonly timelineState = signal<'idle' | 'syncing' | 'done' | 'skipped' | 'failed'>('idle');
  protected readonly timelineNote = signal<string | null>(null);
  protected readonly timelineProspectId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    sessionStatus: ['', Validators.required],
    sessionRemark: ['', [Validators.minLength(3)]],
    interestLevel: [''],
    nextAction: [''],
    followUpDate: [''],
    rebookDate: [''],
    rebookTime: [''],
    id: [''],
  });

  protected readonly needsInterest = computed(() => this.selected() === 'Completed');
  protected readonly needsRebook = computed(() => this.selected() === 'Rebooked');
  protected readonly needsFollowUp = computed(() =>
    ['Completed', 'No Show from Prospect', 'No Show from Partner', 'Incomplete', 'Rebooked'].includes(this.selected()),
  );

  protected readonly remarkLabel = computed(() => {
    switch (this.selected()) {
      case 'Completed':
        return 'What happened in the session?';
      case 'Cancelled':
        return 'Why is it cancelled?';
      case 'Rebooked':
        return 'Why are you rebooking?';
      default:
        return 'Leave a comment or remark';
    }
  });

  protected readonly remarkPlaceholder = computed(() => {
    switch (this.selected()) {
      case 'Completed':
        return 'e.g. Presented the business, she’s excited about retail — wants pricing Thursday';
      case 'No Show from Prospect':
        return 'e.g. No join after 15 min, sent WhatsApp nudge';
      case 'No Show from Partner':
        return 'e.g. Stuck in traffic, apologised and offered two new times';
      case 'Rebooked':
        return 'e.g. Asked to move to next week — prefers evenings';
      default:
        return 'What should you remember next time?';
    }
  });

  ngOnInit(): void {
    this.form.get('id')?.setValue(this.data?._id ?? '');
    this.applyValidators('');
  }

  protected pick(value: OutcomeValue): void {
    this.selected.set(value);
    this.saved.set(false);
    this.error.set(null);
    this.form.get('sessionStatus')?.setValue(value);
    this.form.get('sessionStatus')?.markAsTouched();
    this.applyValidators(value);
  }

  private applyValidators(outcome: string): void {
    const remark = this.form.get('sessionRemark');
    const interest = this.form.get('interestLevel');
    const rebookDate = this.form.get('rebookDate');
    const needsRemark = !['Scheduled', 'In Progress', ''].includes(outcome);
    if (needsRemark) remark?.setValidators([Validators.required, Validators.minLength(3)]);
    else remark?.setValidators([Validators.minLength(3)]);
    if (outcome === 'Completed') interest?.setValidators([Validators.required]);
    else interest?.setValidators([]);
    if (outcome === 'Rebooked') rebookDate?.setValidators([Validators.required]);
    else rebookDate?.setValidators([]);
    remark?.updateValueAndValidity({ emitEvent: false });
    interest?.updateValueAndValidity({ emitEvent: false });
    rebookDate?.updateValueAndValidity({ emitEvent: false });
  }

  protected displayName(): string {
    const s = `${this.data?.surname ?? ''} ${this.data?.name ?? ''}`.trim();
    return s || 'Session';
  }

  protected initials(): string {
    const s = this.displayName();
    const parts = s.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? 'S') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  protected sessionWhen(): string {
    const d = this.data?.consultDate ? new Date(this.data.consultDate) : null;
    const day = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : 'date to confirm';
    return `${day}${this.data?.consultTime ? ` · ${this.data.consultTime}` : ''}`;
  }

  protected statusClass(status: string | undefined): string {
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

  protected timingLabel(): string {
    const raw = this.data?.consultDate;
    if (!raw) return 'No date';
    const day = new Date(raw);
    if (Number.isNaN(day.getTime())) return 'No date';
    const a = new Date(day);
    const b = new Date();
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    if (a.getTime() < b.getTime()) return 'Past';
    if (a.getTime() === b.getTime()) return 'Today';
    return 'Upcoming';
  }

  protected timingClass(): string {
    const label = this.timingLabel();
    if (label === 'Past') return 'dp-status--warn';
    if (label === 'Today') return 'dp-status--info';
    if (label === 'Upcoming') return 'dp-status--ok';
    return '';
  }

  protected whatsAppLink(): string | null {
    const raw = String(this.data?.phone ?? '').replace(/\D/g, '');
    if (!raw) return null;
    const text = encodeURIComponent(`Hi ${this.data?.name ?? ''}, following up on our session — are you free to reconnect?`);
    return `https://wa.me/${raw}?text=${text}`;
  }

  protected todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Datepicker hands back a Date — legacy text input gave a string. Accept both. */
  private formatDateValue(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const s = String(value).trim();
    if (!s) return '';
    const d = new Date(s);
    if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  }

  protected onSubmit(): void {
    if (this.saving() || this.saved()) return;
    if (!this.selected()) {
      this.form.get('sessionStatus')?.markAsTouched();
      return;
    }
    this.applyValidators(this.selected());
    Object.keys(this.form.controls).forEach((name) => this.form.get(name)?.markAsTouched());
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const composed = this.composeRemark(v);
    this.saving.set(true);
    this.error.set(null);

    // Legacy contract: only id + sessionStatus + sessionRemark are read by
    // `PUT booking/update` — extra form fields are ignored server-side.
    const payload = { id: this.data?._id, sessionStatus: v.sessionStatus, sessionRemark: composed };
    this.prospects.updateBookingStatus(payload as never).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        // Best-effort: mirror the outcome into the pipeline timeline so it
        // shows on prospect detail. Never blocks or undoes the booking save.
        this.syncToTimeline(composed, {
          interestLevel: v.interestLevel,
          nextAction: v.nextAction,
          followUpDate: v.followUpDate,
        });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  /**
   * Mirror this outcome into the prospect's follow-up timeline.
   * Bookings carry no prospectId, so the server resolves the booking phone
   * to one contact id in the requester's own + downline pipeline. The response
   * contains ids only — never a phone — so consent-hidden contacts are safe.
   * All failures are soft; the booking save stands.
   */
  private syncToTimeline(
    composed: string,
    extra: { interestLevel: string; nextAction: string; followUpDate: unknown },
  ): void {
    const partnerId = this.data?._partnerId ?? this.data?.partnerId ?? null;
    const phone = this.data?.phone ?? null;
    if (!phone) {
      this.timelineState.set('skipped');
      this.timelineNote.set('Outcome kept on the session — no linked pipeline prospect to update.');
      return;
    }
    this.timelineState.set('syncing');
    this.timelineNote.set(null);
    this.timelineProspectId.set(null);
    this.lookupOwnPipeline(partnerId, phone, composed, extra);
  }

  private lookupOwnPipeline(
    partnerId: unknown,
    phone: unknown,
    composed: string,
    extra: { interestLevel: string; nextAction: string; followUpDate: unknown },
  ): void {
    if (!partnerId) {
      this.timelineState.set('skipped');
      this.timelineNote.set('Outcome kept on the session — no matching pipeline prospect found for this phone.');
      return;
    }
    this.leads.listByPartner(String(partnerId), { q: String(phone), limit: 50 }).subscribe({
      next: (res) => {
        const items = res?.data ?? [];
        const hit = items.find((p) => phonesMatch(p.prospectPhone, phone))
          ?? (items.length === 1 ? items[0] : null);
        if (!hit) {
          this.timelineState.set('skipped');
          this.timelineNote.set('Outcome kept on the session — no matching pipeline prospect found for this phone.');
          return;
        }
        this.pushTimeline(hit.id, composed, extra);
      },
      error: (err: unknown) => {
        this.timelineState.set('failed');
        this.timelineNote.set(`Saved on the session, but timeline lookup failed: ${toApiError(err).message}`);
      },
    });
  }

  private pushTimeline(
    prospectId: string,
    composed: string,
    extra: { interestLevel: string; nextAction: string; followUpDate: unknown },
  ): void {
    const interest = (['hot', 'warm', 'cold'] as const).includes(extra.interestLevel as never)
      ? (extra.interestLevel as 'hot' | 'warm' | 'cold')
      : 'warm';
    const followUp = this.formatDateValue(extra.followUpDate);
    const followUpAction = String(extra.nextAction ?? '').trim().slice(0, 500)
      || (followUp ? `Follow up by ${followUp}` : `Session outcome: ${this.selected() || 'recorded'}`);
    const me = this.auth.currentUser();
    const authorName = [me?.name, me?.surname].filter(Boolean).join(' ') || String(me?.username ?? '');
    this.leads.logCommunication(prospectId, {
      type: commTypeFor(this.data?.contactMethod),
      interestLevel: interest,
      date: new Date().toISOString().slice(0, 10),
      duration: 0,
      description: composed.slice(0, 5000),
      followUpAction,
      ...(me?.id ? { createdBy: String(me.id) } : {}),
      ...(authorName ? { createdByName: authorName } : {}),
    }).subscribe({
      next: () => {
        this.timelineState.set('done');
        this.timelineProspectId.set(prospectId);
        this.timelineNote.set('Also logged to the prospect follow-up timeline.');
      },
      error: (err: unknown) => {
        this.timelineState.set('failed');
        this.timelineNote.set(`Saved on the session, but timeline update failed: ${toApiError(err).message}`);
      },
    });
  }

  private composeRemark(v: {
    sessionStatus: string;
    sessionRemark: string;
    interestLevel: string;
    nextAction: string;
    followUpDate: unknown;
    rebookDate: string;
    rebookTime: string;
  }): string {
    const status = v.sessionStatus;
    const tag = status === 'Completed' && v.interestLevel ? `[${status} · ${v.interestLevel}]` : `[${status}]`;
    let note = `${tag} ${(v.sessionRemark ?? '').trim()}`;
    const followUp = this.formatDateValue(v.followUpDate);
    const extras: string[] = [];
    if (v.nextAction?.trim()) {
      extras.push(`Next: ${v.nextAction.trim()}${followUp ? ` by ${followUp}` : ''}`);
    } else if (followUp) {
      extras.push(`Follow up by ${followUp}`);
    }
    if (status === 'Rebooked' && v.rebookDate) {
      extras.push(`Rebook: ${v.rebookDate}${v.rebookTime ? ` ${v.rebookTime}` : ''}`);
    }
    if (extras.length > 0) note += ` | ${extras.join(' | ')}`;
    // Preserve history: backend overwrites `description`, so carry the old
    // note forward instead of silently dropping it.
    const prev = String(this.data?.description ?? '').trim();
    if (prev && !prev.includes(note)) {
      const stamp = new Date().toLocaleDateString();
      return `${prev}\n\n— ${stamp} ${note}`;
    }
    return note;
  }

  protected remove(): void {
    const id = this.data?._id;
    if (!id || this.deleting()) return;
    this.deleting.set(true);
    this.error.set(null);
    this.prospects.deleteBookings(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected close(changed: boolean): void {
    this.dialogRef.close(changed);
  }
}
