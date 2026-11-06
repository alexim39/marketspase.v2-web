import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { RouterModule } from '@angular/router';
import { LeadPipelineService } from '../../prospects/lead-pipeline/lead-pipeline.service';
import {
  ContactListBatch, ContactListEntry, ContactPriority, RELATIONSHIP_TAGS, RelationshipTag,
} from '../../prospects/lead-pipeline/lead.models';
import { ApiError } from '../../../../core/http/api-error';

const toHHMM = (d: Date): string => {
  const pad = (v: number): string => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Nigerian mobile numbers: 080… / +234… with a 10-digit 7/8/9 block
 * (covers all NCC 070/080/081/090/091 allocations). Spaces and dashes
 * are ignored so `0803 123 4567` validates.
 */
const NG_PHONE_RE = /^(?:\+?234|0)([789]\d{9})$/;
const nigerianPhoneValidator = (control: AbstractControl): ValidationErrors | null => {
  const raw = String(control.value ?? '');
  if (!raw.trim()) return null;
  return NG_PHONE_RE.test(raw.replace(/[\s\-()]/g, '')) ? null : { ngPhone: true };
};

/**
 * @title My contact list — onboarding deliverable.
 *
 * Quick-add people you plan to introduce (name + phone + tag in seconds),
 * watch the counter climb, then submit any time — your upline is notified
 * and works the list with you. Submitted batches
 * show pipeline progress underneath. OnPush + signals, fully typed.
 */
@Component({
selector: 'async-create-contatcs',
imports: [
  CommonModule, DatePipe, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatChipsModule, MatIconModule,
  MatInputModule, MatProgressBarModule, MatSelectModule, MatTimepickerModule, ReactiveFormsModule, RouterModule,
],
template: `
<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard">Dashboard</a> &gt;
    <span>My contact list</span>
  </div>
</section>

<section class="list-page">
  <div class="page-head">
    <div>
      <h2>My contact list</h2>
      <p class="subtitle">People you plan to introduce into the business. Add them gradually — your list saves as you go. Submit once you reach {{ minRequired() }}+ for your upline to work with you.</p>
    </div>
    <span class="count-pill" [class.count-pill--ready]="canSubmit()">{{ unsubmittedCount() }} saved · submit at {{ minRequired() }}+</span>
  </div>

  @if (loading()) {
    <mat-progress-bar mode="indeterminate" aria-label="Loading" />
  }

  @if (error(); as err) {
    <p class="error" role="alert">
      {{ err }}
      <button mat-button (click)="reload()">Retry</button>
    </p>
  }

  @if (notice(); as note) {
    <p class="notice" role="status">{{ note }}</p>
  }

  <form class="dp-card add-card" [formGroup]="form" (ngSubmit)="add()">
    <h3>Add someone <span class="muted">— Enter adds another, fast</span></h3>
    <div class="two-col">
      <mat-form-field appearance="outline">
        <mat-label>Full name</mat-label>
        <input matInput formControlName="prospectName" maxlength="80" placeholder="e.g. Adaeze Obi" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Phone number</mat-label>
        <input matInput formControlName="prospectPhone" inputmode="tel" maxlength="20" placeholder="e.g. 0803 123 4567" />
        @if (form.get('prospectPhone')?.hasError('ngPhone') && form.get('prospectPhone')?.touched) {
          <mat-error>Enter a valid Nigerian mobile number (e.g. 0803 123 4567).</mat-error>
        }
      </mat-form-field>
    </div>
    <div class="two-col">
      <mat-form-field appearance="outline">
        <mat-label>Relationship</mat-label>
        <mat-select formControlName="relationship">
          @for (t of tags; track t) {
            <mat-option [value]="t">{{ t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <div class="priority-row" role="group" aria-label="Priority">
        <mat-button-toggle-group formControlName="priority" aria-label="Priority">
          <mat-button-toggle value="normal">Normal</mat-button-toggle>
          <mat-button-toggle value="high">High priority</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
    </div>
    <div class="two-col">
      <mat-form-field appearance="outline">
        <mat-label>Email (optional)</mat-label>
        <input matInput formControlName="prospectEmail" inputmode="email" maxlength="254" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Best time to call (optional)</mat-label>
        <input matInput [matTimepicker]="bestTimePicker" formControlName="bestTimeToCall" placeholder="e.g. 19:00" />
        <mat-timepicker-toggle matSuffix [for]="bestTimePicker" />
        <mat-timepicker #bestTimePicker interval="30m" />
      </mat-form-field>
    </div>
    <mat-form-field appearance="outline">
      <mat-label>Notes (optional)</mat-label>
      <textarea matInput rows="2" formControlName="notes" maxlength="2000" placeholder="Interests, context, anything useful"></textarea>
    </mat-form-field>
    <mat-checkbox formControlName="consentToContact">They agreed to be contacted</mat-checkbox>
    <div class="form-actions">
      <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || adding()">
        {{ adding() ? 'Adding…' : 'Add to list' }}
      </button>
      @if (formError(); as err) {
        <span class="error" role="alert">{{ err }}</span>
      }
    </div>
  </form>

  @if (entries().length > 0) {
    <h3>On your list ({{ entries().length }})</h3>
    <ul class="entry-list">
      @for (e of entries(); track e.id) {
        <li class="dp-card entry">
          @if (editingId() === e.id) {
            <div class="edit-row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Full name</mat-label>
                <input matInput [value]="editName()" (input)="editName.set($any($event.target).value)" maxlength="80" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Phone</mat-label>
                <input matInput [value]="editPhone()" (input)="editPhone.set($any($event.target).value)" inputmode="tel" maxlength="20" />
              </mat-form-field>
              <button mat-flat-button color="primary" (click)="saveEdit(e)" [disabled]="savingEdit()">{{ savingEdit() ? 'Saving…' : 'Save' }}</button>
              <button mat-button (click)="cancelEdit()" [disabled]="savingEdit()">Cancel</button>
            </div>
            @if (editError(); as err) {
              <p class="error" role="alert">{{ err }}</p>
            }
          } @else {
            <div>
              <strong>{{ e.prospectName }} {{ e.prospectSurname }}</strong>
              <span class="muted"> · {{ e.prospectPhone }}</span>
              <div class="entry-tags">
                <mat-chip highlighted>{{ e.relationship }}</mat-chip>
                @if (e.priority === 'high') {
                  <mat-chip color="warn" highlighted>High priority</mat-chip>
                }
              </div>
            </div>
            <span class="spacer"></span>
            @if (confirmDeleteId() === e.id) {
              <button mat-button color="warn" (click)="remove(e.id)" [disabled]="deleting()">Confirm</button>
              <button mat-button (click)="confirmDeleteId.set(null)">Cancel</button>
            } @else {
              <button mat-icon-button (click)="startEdit(e)" aria-label="Edit contact" title="Edit">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button (click)="confirmDeleteId.set(e.id)" aria-label="Remove contact" title="Remove">
                <mat-icon>delete</mat-icon>
              </button>
            }
          }
        </li>
      }
    </ul>

    <div class="dp-card submit-card">
      <div>
        <strong>Submit your list</strong>
        <p class="muted">Submit when ready ({{ minRequired() }}+ contacts) — your upline gets notified and starts calling with you.</p>
      </div>
      <span class="spacer"></span>
      @if (confirmSubmit()) {
        <button mat-flat-button color="primary" (click)="submit()" [disabled]="submitting() || !canSubmit()">
          {{ submitting() ? 'Submitting…' : 'Confirm submit' }}
        </button>
        <button mat-button (click)="confirmSubmit.set(false)">Cancel</button>
      } @else {
        <button mat-flat-button color="primary" (click)="confirmSubmit.set(true)" [disabled]="!canSubmit()">
          Submit {{ unsubmittedCount() }} contact{{ unsubmittedCount() === 1 ? '' : 's' }}
        </button>
      }
    </div>
  }

  @if (batches().length > 0) {
    <h3>Submitted lists</h3>
    <ul class="batch-list">
      @for (b of batches(); track b.batch) {
        <li class="dp-card batch">
          <div>
            <strong>{{ b.total }} contacts</strong>
            <span class="muted"> · submitted {{ b.submittedAt | date:'mediumDate' }} · {{ b.worked }} worked</span>
            <div class="entry-tags">
              @for (stage of stageKeys(b); track stage) {
                <mat-chip highlighted>{{ stage }} ({{ b.stageCounts[stage] }})</mat-chip>
              }
            </div>
          </div>
        </li>
      }
    </ul>
  }
</section>
`,
changeDetection: ChangeDetectionStrategy.OnPush,
styles: [`
  .breadcrumb-wrapper { margin-bottom: 1em; }
  .breadcrumb a { text-decoration: none; }
  .list-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
  .list-page h3 { margin: 0.5em 0 0; }
  .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; flex-wrap: wrap; }
  .page-head h2 { margin: 0; }
  .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 40em; }
  .count-pill { font-size: 1em; font-weight: 800; border-radius: 999px; padding: 0.35em 1em; background: var(--ms-surface); border: 1px solid var(--ms-line); color: var(--ms-text-muted); white-space: nowrap; }
  .count-pill--ready { background: var(--ms-success-soft); border-color: var(--ms-success); color: var(--ms-success); }
  html[data-theme="dark"] .count-pill--ready { color: #9ccc9f; }
  .add-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
  .add-card h3 { margin: 0; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
  @media only screen and (max-width: 600px) {
    .two-col { grid-template-columns: 1fr; }
  }
  .priority-row { display: flex; align-items: center; }
  .form-actions { display: flex; align-items: center; gap: 0.75em; }
  .form-actions button { min-height: 44px; }
  .entry-list, .batch-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
  .entry, .batch { padding: 0.8em 1em; display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap; }
  .edit-row { display: flex; gap: 0.6em; flex-wrap: wrap; align-items: center; width: 100%; }
  .edit-row mat-form-field { flex: 1; min-width: 160px; }
  .edit-row button { min-height: 44px; }
  .entry-tags { display: flex; gap: 0.3em; margin-top: 0.3em; flex-wrap: wrap; }
  .spacer { flex: 1; }
  .submit-card { padding: 1em; display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap; border-left: 4px solid var(--ms-primary); }
  .submit-card p { margin: 0.2em 0 0; }
  .submit-card button { min-height: 44px; }
  .muted { color: var(--ms-text-muted); font-size: 0.85em; }
  .error { color: var(--ms-error); display: flex; align-items: center; gap: 0.5em; }
  .notice { color: var(--ms-success, #2e7d32); }
`],
})
export class CreateContactsComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tags = RELATIONSHIP_TAGS;
  protected readonly loading = signal(true);
  protected readonly adding = signal(false);
  protected readonly submitting = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly entries = signal<ContactListEntry[]>([]);
  protected readonly unsubmittedCount = signal(0);
  protected readonly minRequired = signal(1);
  protected readonly canSubmit = signal(false);
  protected readonly batches = signal<ContactListBatch[]>([]);
  protected readonly confirmDeleteId = signal<string | null>(null);
  protected readonly confirmSubmit = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editName = signal('');
  protected readonly editPhone = signal('');
  protected readonly savingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    prospectName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    prospectPhone: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(20), nigerianPhoneValidator]],
    prospectEmail: [''],
    relationship: ['Friend' as string, Validators.required],
    priority: ['normal' as string, Validators.required],
    bestTimeToCall: [null as Date | null],
    consentToContact: [false],
    notes: [''],
  });

  ngOnInit(): void {
    this.reload();
  }

  protected stageKeys(b: ContactListBatch): string[] {
    return Object.keys(b.stageCounts ?? {}).sort();
  }

  protected startEdit(e: ContactListEntry): void {
    this.editingId.set(e.id);
    this.editName.set(`${e.prospectName} ${e.prospectSurname}`.trim());
    this.editPhone.set(e.prospectPhone);
    this.editError.set(null);
    this.confirmDeleteId.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
  }

  protected saveEdit(e: ContactListEntry): void {
    const name = this.editName().trim();
    const phone = this.editPhone().trim();
    if (!name || name.length < 2) {
      this.editError.set('Name must be at least 2 characters.');
      return;
    }
    const ngPhoneRe = /^(?:\+?234|0)([789]\d{9})$/;
    if (!ngPhoneRe.test(phone.replace(/[\s\-()]/g, ''))) {
      this.editError.set('Enter a valid Nigerian mobile number (e.g. 0803 123 4567).');
      return;
    }
    this.savingEdit.set(true);
    this.editError.set(null);
    // Split full name into prospectName + prospectSurname for the legacy schema.
    const parts = name.split(/\s+/);
    const prospectName = parts.shift() ?? name;
    const prospectSurname = parts.join(' ');
    this.leads
      .updateContact(e.id, { prospectName, prospectSurname, prospectPhone: phone })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.editingId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.savingEdit.set(false);
          this.editError.set(err.message);
        },
      });
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.leads
      .contactListMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const data = res.data;
          this.entries.set(data?.unsubmitted ?? []);
          this.unsubmittedCount.set(data?.unsubmittedCount ?? 0);
          this.minRequired.set(data?.minRequired ?? 1);
          this.canSubmit.set(data?.canSubmit ?? false);
          this.batches.set(data?.batches ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected add(): void {
    if (this.form.invalid || this.adding()) return;
    this.adding.set(true);
    this.formError.set(null);
    this.notice.set(null);
    const v = this.form.getRawValue();
    this.leads
      .createContact({
        prospectName: v.prospectName.trim(),
        prospectPhone: v.prospectPhone.trim(),
        ...(v.prospectEmail.trim() ? { prospectEmail: v.prospectEmail.trim() } : {}),
        prospectSource: 'Contact List',
        relationship: v.relationship as RelationshipTag,
        priority: v.priority as ContactPriority,
        bestTimeToCall: v.bestTimeToCall instanceof Date ? toHHMM(v.bestTimeToCall) : '',
        consentToContact: v.consentToContact,
        notes: v.notes.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.adding.set(false);
          this.form.reset({ relationship: 'Friend', priority: 'normal', consentToContact: false });
          this.reload();
        },
        error: (err: ApiError) => {
          this.adding.set(false);
          this.formError.set(err.message);
        },
      });
  }

  protected remove(id: string): void {
    this.deleting.set(true);
    this.leads
      .removeProspect(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmDeleteId.set(null);
          this.reload();
        },
        error: (err: ApiError) => {
          this.deleting.set(false);
          this.error.set(err.message);
        },
      });
  }

  protected submit(): void {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.leads
      .submitContactList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.confirmSubmit.set(false);
          this.notice.set(`List submitted — ${res.data?.count ?? ''} contacts sent to your upline.`);
          this.reload();
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.error.set(err.message);
        },
      });
  }
}
