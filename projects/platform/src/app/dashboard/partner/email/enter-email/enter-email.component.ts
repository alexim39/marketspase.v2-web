import {Component, Input, OnDestroy, OnInit, ChangeDetectionStrategy, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {MatInputModule} from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { EmailService } from '../email.service';
import { Router } from '@angular/router';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';

import { ContactsService } from '../../contacts/contacts.service';
import { ExportContactAndEmailService } from '../../../../_common/services/exportContactAndEmail.service';
import { LeadPipelineService } from '../../prospects/lead-pipeline/lead-pipeline.service';
import { TemplateHandoffService } from '../../../../_common/services/template-handoff.service';
import { ApiError, userError } from '../../../../core/http/api-error';

const MAX_LOG_MIRROR = 50;

const TEMPLATES = [
  { label: 'Follow-up nudge', subject: 'Quick follow-up', text: 'Hi, just following up on our last chat. Are you free for a quick call this week?' },
  { label: 'Session invite', subject: 'You are invited: free business session', text: 'Hi! I would like to invite you to a free session on growing your income. Reply to this email and I will book you in.' },
  { label: 'Pricing follow-up', subject: 'Pricing we discussed', text: 'Hi, sharing the pricing we discussed. Let me know which option works for you and I will reserve it.' },
];

/**
 * @title enter-email
 *
 * Bulk email composer in three guided steps: recipients, message,
 * review and send. Contact imports patch the address field only, so a
 * typed subject and body are never wiped.
 */
@Component({
selector: 'async-enter-email',
template:`

<form (ngSubmit)="onSubmit()" [formGroup]="bulckEmailForm">
  <p class="form-section-label">1 · Recipients</p>

  <mat-form-field appearance="outline" class="email-address">
    <mat-label>Enter Email Addresses</mat-label>
    <textarea matInput placeholder="Ex. alex@async.com, alex@async.ng, ..." formControlName="prospects"></textarea>
    <mat-hint align="start"><strong>Separate each email with a comma</strong> </mat-hint>
    @if (bulckEmailForm.get('prospects')?.hasError('required') ) {
      <mat-error>
        At least an email address should be entered
      </mat-error>
    }
  </mat-form-field>

  <p class="form-section-label">2 · Message</p>

  <mat-form-field appearance="outline" class="sender-id">
    <mat-label>Email Subject</mat-label>
    <input matInput placeholder="Eg. Meeting Request: Join Our Online Strategy Discussion" formControlName="emailSubject">
    @if (bulckEmailForm.get('emailSubject')?.hasError('required') ) {
      <mat-error>
        This field is required.
      </mat-error>
    }
  </mat-form-field>

  <mat-form-field appearance="outline" class="template-field">
    <mat-label>Use a template (optional)</mat-label>
    <mat-select (selectionChange)="applyTemplate($event.value)">
      @for (t of templates; track t.label) {
        <mat-option [value]="t">{{ t.label }}</mat-option>
      }
    </mat-select>
  </mat-form-field>

  <mat-form-field appearance="outline" class="email-message">
    <mat-label>Type Email Messages</mat-label>
    <textarea matInput placeholder="Email messages here ..." formControlName="emailBody"></textarea>
    @if (bulckEmailForm.get('emailBody')?.hasError('required') ) {
      <mat-error>
        Enter the email message to be sent
      </mat-error>
    }
  </mat-form-field>

  <p class="form-section-label">3 · Review & send</p>

  <div class="send-row" role="radiogroup" aria-label="Send timing">
    <button mat-button type="button" (click)="sendMode = 'now'" [color]="sendMode === 'now' ? 'primary' : undefined">Send now</button>
    <button mat-button type="button" (click)="sendMode = 'later'" [color]="sendMode === 'later' ? 'primary' : undefined">Schedule</button>
    @if (sendMode === 'later') {
      <input type="datetime-local" [(ngModel)]="scheduledAt" [ngModelOptions]="{standalone: true}" aria-label="Scheduled date and time" />
    }
  </div>

  @if (recipientCount() > 0) {
    <p class="cost-preview" role="status">
      {{ recipientCount() }} recipient{{ recipientCount() === 1 ? '' : 's' }} · free via platform mail
    </p>
  }

  <button mat-flat-button [disabled]="sending">{{ sending ? 'Sending…' : (sendMode === 'later' ? 'Schedule Email' : 'Send Email') }}</button>
  @if (formError) {
    <p class="error" role="alert">{{ formError }}</p>
  }
</form>

@if (scheduled.length > 0) {
  <div class="scheduled">
    <h4>Scheduled emails</h4>
    <ul>
      @for (s of scheduled; track s.id) {
        <li>
          <div>
            <strong>{{ s.sendAt | date:'medium' }}</strong>
            <span class="muted"> · {{ s.total }} recipient{{ s.total === 1 ? '' : 's' }} · {{ s.status }}</span>
            <div class="muted small">{{ s.emailSubject }}</div>
          </div>
          <span class="spacer"></span>
          @if (s.status === 'scheduled') {
            <button mat-button color="warn" type="button" (click)="cancelSchedule(s.id)">Cancel</button>
          }
        </li>
      }
    </ul>
  </div>
}

`,
styles: `

form {
    margin: 0;
    padding: 1em 0 0.5em;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.9em;

    .form-section-label {
        font-size: 0.78em;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ms-primary-strong);
        margin: 0.4em 0 -0.3em;
    }

    .sender-id {
        max-width: 560px;
    }
    .email-address, .email-message, .template-field {
        width: 100%;
    }
    .email-address {
        textarea {
          min-height: 100px;
          max-height: 300px;
          width: 100%;
          font-size: 1rem;
        }
    }
    .email-message {
        textarea {
          min-height: 140px;
          max-height: 800px;
          width: 100%;
          font-size: 1rem;
        }
    }

    button {
        min-height: 44px;
        margin-top: 4px;
        align-self: flex-start;
    }

    .send-row {
        display: flex;
        gap: 0.5em;
        align-items: center;
        flex-wrap: wrap;
    }

    .send-row button { min-height: 44px; }

    .send-row input[type="datetime-local"] {
        min-height: 44px;
        border: 1px solid var(--ms-line);
        border-radius: 4px;
        padding: 0 0.6em;
        background: transparent;
        color: inherit;
        font: inherit;
    }

    .scheduled { margin-top: 1em; }
    .scheduled h4 { margin: 0 0 0.4em; }
    .scheduled ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .scheduled li {
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.6em 0;
        border-top: 1px solid var(--ms-line);
        flex-wrap: wrap;
    }
    .scheduled .spacer { flex: 1; }
    .scheduled .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .scheduled .small { font-size: 0.8em; }

    .cost-preview {
        margin: 0;
        font-size: 0.9em;
        color: var(--ms-text-muted);
        background: var(--ms-canvas);
        border: 1px solid var(--ms-line);
        border-radius: 8px;
        padding: 0.6em 0.8em;
    }

    .error {
        color: var(--ms-error);
    }
    html[data-theme='dark'] .error {
        color: #e89a9a;
    }
}


 /* Media Query for Mobile Responsiveness */
@media screen and (max-width: 600px) {
    form {
        button {
            width: 100%;
            align-self: stretch;
        }
    }
}

`,
providers: [ContactsService],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [CommonModule, MatInputModule, MatButtonModule, MatSelectModule, FormsModule, ReactiveFormsModule, MatFormFieldModule]
})
export class EnterEmailComponent implements OnInit, OnDestroy {
    private readonly ui = inject(UiFeedbackService);
    @Input() partner!: PartnerInterface;
    bulckEmailForm!: FormGroup;
    subscriptions: Array<Subscription> = [];
    protected readonly templates = TEMPLATES;

    sending = false;
    formError: string | null = null;
    sendMode: 'now' | 'later' = 'now';
    scheduledAt = '';
    scheduled: Array<{ id: string; total: number; smsBody: string; emailSubject: string; sendAt: string; status: string }> = [];
    cancellingId: string | null = null;

    constructor(
      private emailService: EmailService,
      private router: Router,
      private contactsService: ContactsService,
      private leads: LeadPipelineService,
      private handoff: TemplateHandoffService,
      private exportContactAndEmailService: ExportContactAndEmailService
    ) {}


    ngOnInit(): void {
      this.bulckEmailForm = new FormGroup({
        emailSubject: new FormControl('', Validators.required),
        prospects: new FormControl('', Validators.required),
        emailBody: new FormControl('', Validators.required),
        partnerId: new FormControl(this.partner._id),
      });

      this.subscriptions.push(
        this.exportContactAndEmailService.data$.subscribe(data => {
          const contactEmails: Array<string> = data;
          if (contactEmails && contactEmails.length > 0 && this.bulckEmailForm) {
            // Patch addresses only — never wipe a typed subject and body.
            this.bulckEmailForm.get('prospects')?.setValue(contactEmails);
          }
        })
      );

      // One-shot template handoff from the content library.
      const handed = this.handoff.takeText();
      if (handed && this.bulckEmailForm) {
        const current = String(this.bulckEmailForm.get('emailBody')?.value ?? '').trim();
        this.bulckEmailForm.get('emailBody')?.setValue(current ? `${current}\n\n${handed}` : handed);
      }

      this.reloadScheduled();
     }

    protected reloadScheduled(): void {
      this.subscriptions.push(
        this.emailService.listScheduledEmails().subscribe({
          next: (res) => {
            this.scheduled = res?.data ?? [];
          },
          error: () => {},
        })
      );
    }

    protected recipientCount(): number {
      const v = this.bulckEmailForm.get('prospects')?.value;
      const arr = typeof v === 'string' ? v.split(',') : Array.isArray(v) ? v : [];
      return arr.map((e) => String(e).trim()).filter(Boolean).length;
    }

    protected applyTemplate(t: { subject: string; text: string }): void {
      if (!t) return;
      if (!String(this.bulckEmailForm.get('emailSubject')?.value ?? '').trim()) {
        this.bulckEmailForm.get('emailSubject')?.setValue(t.subject);
      }
      this.bulckEmailForm.get('emailBody')?.setValue(t.text);
    }

    onSubmit() {
        Object.keys(this.bulckEmailForm.controls).forEach((k) => this.bulckEmailForm.get(k)?.markAsTouched());
        if (!this.bulckEmailForm.valid || this.sending) return;
        const v = this.bulckEmailForm.getRawValue();
        const to = this.toEmails(v.prospects);
        const subject = String(v.emailSubject ?? '').trim();
        const body = String(v.emailBody ?? '').trim();
        if (to.length === 0) {
          this.formError = 'No valid email addresses found.';
          return;
        }
        this.formError = null;
        if (this.sendMode === 'later') return this.schedule(to, subject, body);
        const mirrorTo = [...to];
        const mirrorSubject = subject;
        const mirrorBody = body;
        this.formError = null;
        this.sending = true;

        this.subscriptions.push(
            this.emailService.sendEmail({ to, subject, body }).subscribe({

              next: (response) => {
                this.sending = false;
                this.bulckEmailForm.get('prospects')?.setValue('');
                this.mirrorToTimelines(mirrorTo, mirrorSubject, mirrorBody);
                const failed = response?.data?.failed?.length;
                const message = response.message || 'Email sent successfully.';
                failed ? this.ui.warning(message) : this.ui.success(message);
              },
              error: (error: ApiError) => {
                this.sending = false;
                this.formError = userError(error);
                this.ui.error(this.formError);
              }
          })
        );
    }


    protected toEmails(value: unknown): string[] {
      const arr = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const raw of arr) {
        const email = String(raw ?? '').trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !seen.has(email)) {
          seen.add(email);
          out.push(email);
        }
      }
      return out;
    }

    /** Later mode: queue the email (free channel, fired by the worker). */
    private schedule(to: string[], subject: string, body: string): void {
      const at = this.scheduledAt ? new Date(this.scheduledAt) : null;
      if (!at || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        this.formError = 'Pick a future date and time for the scheduled send.';
        return;
      }
      this.sending = true;
      this.subscriptions.push(
        this.emailService.scheduleBulkEmail({ to, subject, body, sendAt: at.toISOString() }).subscribe({
          next: () => {
            this.sending = false;
            this.bulckEmailForm.get('prospects')?.setValue('');
            this.scheduledAt = '';
            this.sendMode = 'now';
            this.reloadScheduled();
            this.ui.success(`Email scheduled for ${at.toLocaleString()}.`);
          },
          error: (error: ApiError) => {
            this.sending = false;
            this.formError = userError(error);
          },
        })
      );
    }

    protected cancelSchedule(id: string): void {
      this.subscriptions.push(
        this.emailService.cancelScheduledEmail(id).subscribe({
          next: () => this.reloadScheduled(),
          error: (error: ApiError) => {
            this.formError = userError(error);
          },
        })
      );
    }

    /**
     * Mirror bulk sends into matching prospects' timelines (type email) so
     * outreach moves deals in-app. Best-effort, capped, never blocks.
     */
    private mirrorToTimelines(to: string[], subject: string, body: string): void {
      const id = this.partner?._id;
      if (!id || to.length === 0) return;
      const keys = new Set(to.map((e) => e.toLowerCase()));
      this.subscriptions.push(
        this.leads.listByPartner(id, { limit: 500 }).subscribe({
          next: (res) => {
            const hits = (res.data ?? [])
              .filter((p) => p.prospectEmail && keys.has(String(p.prospectEmail).toLowerCase()))
              .slice(0, MAX_LOG_MIRROR);
            const text = `Bulk email "${subject}": ${body}`.slice(0, 5000);
            for (const hit of hits) {
              this.leads.logCommunication(hit.id, {
                type: 'email',
                interestLevel: 'warm',
                date: new Date().toISOString().slice(0, 10),
                duration: 0,
                description: text,
                followUpAction: '',
              }).subscribe({ error: () => {} });
            }
          },
          error: () => {},
        })
      );
    }

    ngOnDestroy() {
        // unsubscribe list
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }
}
