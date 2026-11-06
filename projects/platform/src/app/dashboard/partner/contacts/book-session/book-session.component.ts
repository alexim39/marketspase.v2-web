import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, Input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { Location } from '@angular/common';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { ContactsInterface, ContactsService } from '../contacts.service';
import { ApiError } from '../../../../core/http/api-error';

const toHHMM = (d: Date): string => {
  const pad = (v: number): string => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const REASONS = [
  'About MarketSpase Business',
  'Follow-up Conversation',
  'Product Presentation',
  'Business Guidance',
  'Investment Strategy',
  'Cashflow Management',
  'Wealth Mindset',
  'General Financial Planning',
];

/**
 * @title Book session — schedule a chat with a prospect.
 *
 * Prospect context up top (who you're booking, with links into their
 * detail and the pipeline), session details below: reason, contact
 * method, date + time pickers. Success lands on My sessions so the
 * booking is visible in the list immediately. OnPush + signals.
 */
@Component({
selector: 'async-book-session',
providers: [ContactsService],
imports: [
  CommonModule, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatIconModule,
  MatInputModule, MatProgressBarModule, MatSelectModule, MatTimepickerModule,
  FormsModule, ReactiveFormsModule, RouterModule,
],
template: `
<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard">Dashboard</a> &gt;
    <a routerLink="/dashboard/prospects/pipeline">Prospects</a> &gt;
    <span>Book session</span>
  </div>
</section>

<section class="book-page">
  <div class="page-head">
    <div class="control">
      <button mat-icon-button (click)="back()" title="Back" aria-label="Back">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <div>
        <h2>Book a session{{ prospectName() ? ' with ' + prospectName() : '' }}</h2>
        <p class="subtitle">Pick a reason, a time, a way to reach them — the session lands on your My sessions list.</p>
      </div>
    </div>
    <button mat-icon-button (click)="showDescription()" title="Help" aria-label="Help">
      <mat-icon>help</mat-icon>
    </button>
  </div>

  @if (prospect) {
    <div class="dp-card context-card">
      <div>
        <strong>{{ prospect.prospectName }} {{ prospect.prospectSurname }}</strong>
        <a class="phone" [href]="'tel:' + prospect.prospectPhone">{{ prospect.prospectPhone }}</a>
        <div class="muted">{{ prospect.prospectEmail || 'no email' }} · {{ prospect.prospectSource || 'Contact List' }}</div>
      </div>
      <span class="spacer"></span>
      <a mat-button [routerLink]="['/dashboard/prospects/detail', prospect._id]">Prospect detail</a>
      <a mat-button routerLink="/dashboard/prospects/bookings">My sessions</a>
    </div>
  }

  @if (isDownlineBooking()) {
    <div class="downline-banner" role="note">
      <mat-icon>support_agent</mat-icon>
      <div>
        <strong>Booking for your downline prospect{{ prospectName() ? ' — ' + prospectName() : '' }}.</strong>
        <span class="muted"> This session lands on YOUR My sessions list, and the outcome you record is mirrored to their follow-up timeline. Enrolment credit stays with the owner.</span>
      </div>
    </div>
  }

  @if (saving()) {
    <mat-progress-bar mode="indeterminate" aria-label="Loading" />
  }

  @if (error(); as err) {
    <p class="error" role="alert">{{ err }}</p>
  }

  @if (notice(); as note) {
    <p class="notice" role="status">{{ note }}</p>
  }

  @if (prospectContactForm) {
    <form class="dp-card form-card" [formGroup]="prospectContactForm" (ngSubmit)="onSubmit()">
      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>Session reason</mat-label>
          <mat-select formControlName="reason">
            @for (r of reasons; track r) {
              <mat-option [value]="r">{{ r }}</mat-option>
            }
          </mat-select>
          @if (prospectContactForm.get('reason')?.hasError('required') && prospectContactForm.get('reason')?.touched) {
            <mat-error>This answer is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Preferred contact method</mat-label>
          <mat-select formControlName="contactMethod">
            <mat-option value="Phone">Phone</mat-option>
            <mat-option value="WhatsApp">WhatsApp</mat-option>
            <mat-option value="Text Message">Text Message</mat-option>
            <mat-option value="Email">Email</mat-option>
            <mat-option value="Video Call">Video Call (Zoom, Google Meet, etc.)</mat-option>
            <mat-option value="Any Option">Any Option</mat-option>
          </mat-select>
          @if (prospectContactForm.get('contactMethod')?.hasError('required') && prospectContactForm.get('contactMethod')?.touched) {
            <mat-error>This answer is required</mat-error>
          }
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline">
        <mat-label>What should this session cover? (optional)</mat-label>
        <textarea matInput rows="2" formControlName="description" maxlength="2000"></textarea>
      </mat-form-field>

      <div class="two-col">
        <mat-form-field appearance="outline">
          <mat-label>Session date</mat-label>
          <input matInput [matDatepicker]="sessionDatePicker" formControlName="consultDate" [min]="minDate" />
          <mat-datepicker-toggle matSuffix [for]="sessionDatePicker" />
          <mat-datepicker #sessionDatePicker />
          @if (prospectContactForm.get('consultDate')?.hasError('required') && prospectContactForm.get('consultDate')?.touched) {
            <mat-error>Date is required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Session time</mat-label>
          <input matInput [matTimepicker]="sessionTimePicker" formControlName="consultTime" />
          <mat-timepicker-toggle matSuffix [for]="sessionTimePicker" />
          <mat-timepicker #sessionTimePicker interval="30m" />
          @if (prospectContactForm.get('consultTime')?.hasError('required') && prospectContactForm.get('consultTime')?.touched) {
            <mat-error>Time is required</mat-error>
          }
        </mat-form-field>
      </div>

      <div class="form-actions">
        <button mat-flat-button color="primary" type="submit" [disabled]="prospectContactForm.invalid || saving()">
          {{ saving() ? 'Booking…' : 'Book session' }}
        </button>
      </div>
    </form>
  }
</section>
`,
changeDetection: ChangeDetectionStrategy.OnPush,
styles: [`
  .breadcrumb-wrapper { margin-bottom: 1em; }
  .breadcrumb a { text-decoration: none; }
  .book-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
  .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; }
  .page-head h2 { margin: 0; }
  .control { display: flex; gap: 0.6em; align-items: flex-start; }
  .control button { flex: none; }
  .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 44em; }
  .context-card { padding: 0.9em 1em; display: flex; align-items: center; gap: 0.75em; flex-wrap: wrap; }
  .context-card a { min-height: 44px; }
  .downline-banner { display: flex; align-items: flex-start; gap: 0.6em; background: var(--ms-info-soft); border: 1px solid var(--ms-info); border-radius: 8px; padding: 0.75em 1em; font-size: 0.9em; }
  html[data-theme='dark'] .downline-banner { color: #90caf9; }
  .downline-banner mat-icon { flex: none; }
  .downline-banner div { flex: 1; }
  .phone { color: var(--ms-primary-strong); font-weight: 600; text-decoration: none; margin-left: 0.5em; }
  .spacer { flex: 1; }
  .form-card { padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
  @media only screen and (max-width: 600px) {
    .two-col { grid-template-columns: 1fr; }
  }
  .form-actions button { min-height: 44px; }
  .muted { color: var(--ms-text-muted); font-size: 0.85em; }
  .error { color: var(--ms-error); }
  .notice { color: var(--ms-success, #2e7d32); }
`],
})
export class BookSessionComponent implements OnInit {
    @Input() prospect!: ContactsInterface | any;
    readonly dialog = inject(MatDialog);
    @Input() partner!: PartnerInterface;
    prospectContactForm!: FormGroup;

    protected readonly saving = signal(false);
    protected readonly error = signal<string | null>(null);
    protected readonly notice = signal<string | null>(null);
    protected readonly reasons = REASONS;

    private readonly destroyRef = inject(DestroyRef);
    minDate = new Date();

    constructor(
      private contactsService: ContactsService,
      private router: Router,
      private location: Location,
    ) {}


    ngOnInit(): void {
        if (this.prospect) {
          this.prospectContactForm = new FormGroup({
            reason: new FormControl('', Validators.required),
            description: new FormControl(''),
            consultDate: new FormControl<Date | null>(null, Validators.required),
            consultTime: new FormControl<Date | null>(null, Validators.required),
            contactMethod: new FormControl('', Validators.required),
          });
        }
    }

    protected prospectName(): string {
      if (!this.prospect) return '';
      return `${this.prospect.prospectName ?? ''} ${this.prospect.prospectSurname ?? ''}`.trim();
    }

    /** Upline support: the prospect belongs to someone else in your downline. */
    protected isDownlineBooking(): boolean {
      const owner = (this.prospect as { partnerId?: unknown } | null)?.partnerId;
      const me = (this.partner as { _id?: unknown } | null)?._id;
      return !!owner && !!me && String(owner) !== String(me);
    }

  back(): void {
    if (window.history.length > 1) {
        this.location.back();
    } else {
        this.router.navigateByUrl('/dashboard/prospects/pipeline');
    }
  }

  onSubmit(): void {
    Object.keys(this.prospectContactForm.controls).forEach((name) => {
      this.prospectContactForm.get(name)?.markAsTouched();
    });

    if (this.prospectContactForm.invalid || this.saving()) return;
    const v = this.prospectContactForm.getRawValue();
    const formData: any = {
      reason: v.reason,
      description: v.description ?? '',
      consultDate: v.consultDate,
      consultTime: v.consultTime instanceof Date ? toHHMM(v.consultTime) : v.consultTime,
      contactMethod: v.contactMethod,
      referral: 'Booked for prospect',
      phone: this.prospect?.prospectPhone,
      email: this.prospect?.prospectEmail,
      surname: this.prospect?.prospectSurname,
      name: this.prospect?.prospectName,
      username: this.partner.username,
      // Pipeline link — lets the backend advance the exact prospect stage.
      prospectId: this.prospect?._id ?? this.prospect?.id ?? null,
    };
    this.saving.set(true);
    this.error.set(null);
    this.contactsService.bookSession(formData).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.notice.set(response?.message ?? 'Session booked — see it on your My sessions list.');
        this.router.navigate(['/dashboard/prospects/bookings']);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.error.set(error.message);
      },
    });
  }

    showDescription () {
      this.dialog.open(HelpDialogComponent, {
        data: {help: `
          Book a virtual or physical session for your prospect. After booking, track its outcome on the My sessions page.
        `},
      });
    }
}
