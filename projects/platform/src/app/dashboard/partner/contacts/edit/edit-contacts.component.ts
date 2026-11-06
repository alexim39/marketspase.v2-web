import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { LeadPipelineService } from '../../prospects/lead-pipeline/lead-pipeline.service';
import { RELATIONSHIP_TAGS } from '../../prospects/lead-pipeline/lead.models';
import { ApiError } from '../../../../core/http/api-error';

const NG_PHONE_RE = /^(?:\+?234|0)([789]\d{9})$/;
const nigerianPhoneValidator = (control: AbstractControl): ValidationErrors | null => {
  const raw = String(control.value ?? '');
  if (!raw.trim()) return null;
  return NG_PHONE_RE.test(raw.replace(/[\s\-()]/g, '')) ? null : { ngPhone: true };
};

const toHHMM = (d: Date): string => {
  const pad = (v: number): string => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * @title Edit prospect — correct mistakes before they become pipeline noise.
 *
 * Every field that creates a prospect is editable here with inline
 * validation, including the new contact-list enrichment (relationship,
 * priority, best time, consent, notes). Nigerian phone formatting is
 * enforced with a clear message; cross-partner same phone is allowed,
 * same-partner duplicate is a friendly 409. OnPush + signals.
 */
@Component({
selector: 'async-edit-contatcs',
imports: [
  CommonModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule,
  MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule,
  MatTimepickerModule, PageSkeletonComponent, ReactiveFormsModule, RouterModule,
],
template: `
<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard">Dashboard</a> &gt;
    <a routerLink="/dashboard/prospects/pipeline">Prospects</a> &gt;
    <span>{{ loading() ? 'Edit contact' : (prospectName() || 'Edit contact') }}</span>
  </div>
</section>

<section class="edit-page">
  <div class="page-head">
    <div class="control">
      <button mat-icon-button (click)="back()" aria-label="Back">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <div>
        <h2>Edit contact</h2>
        <p class="subtitle">Fix a typo, update a number, or add context your upline will see.</p>
      </div>
    </div>
  </div>

  @if (loading()) {
    <async-page-skeleton layout="form" [rows]="8" label="contact form" [showHeader]="false" />
  }

  @if (error(); as err) {
    <p class="error" role="alert">
      {{ err }}
      <button mat-button (click)="load()">Retry</button>
    </p>
  }

  @if (notice(); as note) {
    <p class="notice" role="status">{{ note }}</p>
  }

  @if (form) {
    <form class="dp-card form-card" [formGroup]="form" (ngSubmit)="onSubmit()">
      <h3>Identity</h3>
      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>First name</mat-label>
          <input matInput formControlName="prospectName" maxlength="80" />
          @if (form.get('prospectName')?.hasError('required') && form.get('prospectName')?.touched) {
            <mat-error>This is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Surname</mat-label>
          <input matInput formControlName="prospectSurname" maxlength="80" />
        </mat-form-field>
      </div>

      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>Phone number</mat-label>
          <input matInput formControlName="prospectPhone" inputmode="tel" maxlength="20" />
          @if (form.get('prospectPhone')?.hasError('required') && form.get('prospectPhone')?.touched) {
            <mat-error>This is required</mat-error>
          }
          @if (form.get('prospectPhone')?.hasError('ngPhone') && form.get('prospectPhone')?.touched) {
            <mat-error>Enter a valid Nigerian mobile number (e.g. 0803 123 4567).</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email (optional)</mat-label>
          <input matInput formControlName="prospectEmail" inputmode="email" maxlength="254" />
          @if (form.get('prospectEmail')?.hasError('email') && form.get('prospectEmail')?.touched) {
            <mat-error>Enter a valid email.</mat-error>
          }
        </mat-form-field>
      </div>

      <h3>Context your upline sees</h3>
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
          <mat-label>Best time to call</mat-label>
          <input matInput [matTimepicker]="bestTimePicker" formControlName="bestTimeToCall" placeholder="e.g. 19:00" />
          <mat-timepicker-toggle matSuffix [for]="bestTimePicker" />
          <mat-timepicker #bestTimePicker interval="30m" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Source</mat-label>
          <mat-select formControlName="prospectSource">
            <mat-option value="Contact List">Contact List</mat-option>
            <mat-option value="Family">Family</mat-option>
            <mat-option value="Friend">Friend</mat-option>
            <mat-option value="Referrals">Referrals</mat-option>
            <mat-option value="Social Media">Social Media</mat-option>
            <mat-option value="Website">Website</mat-option>
            <mat-option value="Networking Events">Networking Events</mat-option>
            <mat-option value="Other Means">Other Means</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <mat-checkbox formControlName="consentToContact">They agreed to be contacted</mat-checkbox>

      <mat-form-field appearance="outline">
        <mat-label>Notes</mat-label>
        <textarea matInput rows="3" formControlName="notes" maxlength="2000" placeholder="Interests, context, anything useful"></textarea>
      </mat-form-field>

      <div class="form-actions">
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
        <button mat-button type="button" (click)="back()" [disabled]="saving()">Cancel</button>
        @if (formError(); as err) {
          <span class="error" role="alert">{{ err }}</span>
        }
      </div>
    </form>
  }
</section>
`,
changeDetection: ChangeDetectionStrategy.OnPush,
styles: [`
  .breadcrumb-wrapper { margin-bottom: 1em; }
  .breadcrumb a { text-decoration: none; }
  .edit-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
  .page-head { display: flex; align-items: center; }
  .control { display: flex; gap: 0.6em; align-items: flex-start; }
  .control button { flex: none; }
  .page-head h2 { margin: 0; }
  .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
  .form-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
  .form-card h3 { margin: 0.5em 0 0; font-size: 1em; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
  @media only screen and (max-width: 600px) {
    .two-col { grid-template-columns: 1fr; }
  }
  .priority-row { display: flex; align-items: center; }
  .form-actions { display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap; }
  .form-actions button { min-height: 44px; }
  .muted { color: var(--ms-text-muted); font-size: 0.85em; }
  .error { color: var(--ms-error); }
  .notice { color: var(--ms-success, #2e7d32); }
`],
})
export class EditContactsComponent implements OnInit {
    prospectId: string | null = null;
    form!: import('@angular/forms').FormGroup;

    protected readonly loading = signal(false);
    protected readonly saving = signal(false);
    protected readonly error = signal<string | null>(null);
    protected readonly notice = signal<string | null>(null);
    protected readonly formError = signal<string | null>(null);
    protected readonly prospectName = signal<string>('');
    protected readonly tags = RELATIONSHIP_TAGS;

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly location = inject(Location);
    private readonly leads = inject(LeadPipelineService);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);

    ngOnInit(): void {
      this.prospectId = this.route.snapshot.paramMap.get('id');
      if (this.prospectId) this.load();
    }

    protected load(): void {
      if (!this.prospectId) return;
      this.loading.set(true);
      this.error.set(null);
      this.leads
        .getById(this.prospectId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            const p = (res as unknown as { data?: Record<string, unknown> })?.data as Record<string, unknown> ?? (res as unknown as Record<string, unknown>);
            const prospect = (p['prospect'] ?? p) as Record<string, unknown>;
            // LeadPipeline detail shape vs Prospect shape — handle both.
            const data = prospect ?? p;
            const name = String(data['prospectName'] ?? '');
            const surname = String(data['prospectSurname'] ?? '');
            this.prospectName.set(`${name} ${surname}`.trim() || name);
            this.form = this.fb.group({
              prospectName: [String(data['prospectName'] ?? ''), [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
              prospectSurname: [String(data['prospectSurname'] ?? '')],
              prospectPhone: [String(data['prospectPhone'] ?? ''), [Validators.required, nigerianPhoneValidator]],
              prospectEmail: [String(data['prospectEmail'] ?? '') , [Validators.email]],
              prospectSource: [String(data['prospectSource'] ?? 'Contact List'), Validators.required],
              relationship: [String(data['relationship'] ?? 'Other')],
              priority: [String(data['priority'] ?? 'normal')],
              bestTimeToCall: [data['bestTimeToCall'] ? new Date(`1970-01-01T${String(data['bestTimeToCall'])}`) : null],
              consentToContact: [Boolean(data['consentToContact'])],
              notes: [String(data['notes'] ?? data['prospectRemark'] ?? '')],
            });
            this.loading.set(false);
          },
          error: (err: ApiError) => {
            this.error.set(err.message);
            this.loading.set(false);
          },
        });
    }

    protected back(): void {
      if (window.history.length > 1) {
        this.location.back();
      } else {
        this.router.navigate(['/dashboard/prospects/pipeline']);
      }
    }

    onSubmit(): void {
      Object.keys(this.form.controls).forEach((k) => this.form.get(k)?.markAsTouched());
      if (this.form.invalid || !this.prospectId || this.saving()) return;
      const v = this.form.getRawValue();
      this.saving.set(true);
      this.formError.set(null);
      this.notice.set(null);
      this.leads
        .updateContact(this.prospectId, {
          prospectName: String(v.prospectName).trim(),
          prospectSurname: String(v.prospectSurname).trim(),
          prospectPhone: String(v.prospectPhone).trim(),
          prospectEmail: String(v.prospectEmail).trim() || undefined,
          prospectSource: String(v.prospectSource).trim(),
          relationship: v.relationship,
          priority: v.priority,
          bestTimeToCall: v.bestTimeToCall instanceof Date ? toHHMM(v.bestTimeToCall) : String(v.bestTimeToCall ?? '').trim(),
          consentToContact: Boolean(v.consentToContact),
          notes: String(v.notes ?? '').trim(),
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.notice.set('Contact updated.');
            this.router.navigate(['/dashboard/prospects/pipeline']);
          },
          error: (err: ApiError) => {
            this.saving.set(false);
            this.formError.set(err.message);
          },
        });
    }
}
