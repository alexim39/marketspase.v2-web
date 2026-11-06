import { Component, Input, OnDestroy, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { SMSService } from '../sms.service';
import { Router } from '@angular/router';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { MatFormFieldModule } from '@angular/material/form-field';

import { ExportContactAndEmailService } from '../../../../_common/services/exportContactAndEmail.service';
import { TemplateHandoffService } from '../../../../_common/services/template-handoff.service';
import { LeadPipelineService } from '../../prospects/lead-pipeline/lead-pipeline.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError, userError } from '../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';

// Preview-only mirror of the server rate (api Outreach.entity
// SMS_CHARGE_PER_PAGE, env SMS_PRICE_PER_PAGE). The wallet is charged
// server-side — this constant only feeds the "≈ ₦X" estimate.
const SMS_CHARGE_PER_PAGE = 10;
const MAX_LOG_MIRROR = 50;

const TEMPLATES = [
  { label: 'Follow-up nudge', text: 'Hi, just following up on our last chat. Are you free for a quick call this week?' },
  { label: 'Session invite', text: 'Hi! I would like to invite you to a free session on growing your income. Reply YES and I will book you in.' },
  { label: 'Pricing follow-up', text: 'Hi, sharing the pricing we discussed. Let me know which option works for you and I will reserve it.' },
];

const tail9 = (s: string): string => String(s ?? '').replace(/\D/g, '').slice(-9);

/**
 * @title enter-phone-numbers
 *
 * Bulk SMS composer: validate + cost preview + one server-side send
 * (charge, gateway and record happen in a single session-owned call, so
 * the gateway secret never touches the browser). Successful sends are
 * mirrored into matching prospects' follow-up timelines.
 */
@Component({
selector: 'async-enter-phone-numbers',
template: `

<form (ngSubmit)="onSubmit()" [formGroup]="bulckSMSForm">
  <mat-form-field appearance="outline" class="sender-id">
    <mat-label>Sender Id</mat-label>
    <input matInput placeholder="Ex. MarketSpase" maxlength="11" formControlName="senderId" value="C21FG" readonly="true">
    @if (bulckSMSForm.get('senderId')?.hasError('required') ) {
      <mat-error>
        This field is required.
      </mat-error>
    }
  </mat-form-field>

  <p class="form-section-label">1 · Recipients</p>

  <mat-form-field appearance="outline" class="message-phone">
    <mat-label>Enter Phone Numbers</mat-label>
    <textarea matInput placeholder="Ex. 08080386208, 09062537816, ..." formControlName="phoneNumbers"></textarea>
    <mat-hint align="start"><strong>Separate each phone with a comma</strong></mat-hint>
    @if (bulckSMSForm.get('phoneNumbers')?.hasError('required') ) {
      <mat-error>
        At least a phone number should be entered
      </mat-error>
    }
  </mat-form-field>

  <p class="form-section-label">2 · Message</p>

  <mat-form-field appearance="outline" class="template-field">
    <mat-label>Use a template (optional)</mat-label>
    <mat-select (selectionChange)="applyTemplate($event.value)">
      @for (t of templates; track t.label) {
        <mat-option [value]="t.text">{{ t.label }}</mat-option>
      }
    </mat-select>
  </mat-form-field>

  <p class="form-section-label">3 · Review & send</p>

  <div class="send-row" role="radiogroup" aria-label="Send timing">
    <button mat-button type="button" (click)="sendMode = 'now'" [color]="sendMode === 'now' ? 'primary' : undefined">Send now</button>
    <button mat-button type="button" (click)="sendMode = 'later'" [color]="sendMode === 'later' ? 'primary' : undefined">Schedule</button>
    @if (sendMode === 'later') {
      <mat-form-field appearance="outline" class="schedule-field">
        <mat-label>Schedule date and time</mat-label>
        <input matInput type="datetime-local" [(ngModel)]="scheduledAt" [ngModelOptions]="{standalone: true}" />
      </mat-form-field>
    }
  </div>

  <mat-form-field appearance="outline" class="message-phone">
    <mat-label>Enter Text Messages</mat-label>
    <textarea matInput placeholder="Type text messages here ..." formControlName="textMessage" #message maxlength="960"></textarea>
    <mat-hint align="end"><strong>Pages {{pages}}</strong>, {{message.value.length}} / 160</mat-hint>
    @if (bulckSMSForm.get('textMessage')?.hasError('required') ) {
      <mat-error>
        Enter the text message to be sent
      </mat-error>
    }
  </mat-form-field>

  @if (previewCount() > 0) {
    <p class="cost-preview" role="status">
      {{ previewCount() }} recipient{{ previewCount() === 1 ? '' : 's' }} · {{ pages }} page{{ pages === 1 ? '' : 's' }} ·
      cost ₦{{ previewCost().toFixed(2) }} (balance ₦{{ balance().toFixed(2) }})
      @if (invalidCount() > 0) {
        <span> · {{ invalidCount() }} invalid skipped</span>
      }
      @if (!canAfford()) {
        <strong> — insufficient balance</strong>
      }
    </p>
  }

  <button mat-flat-button [disabled]="sending">{{ sending ? 'Sending…' : (sendMode === 'later' ? 'Schedule SMS' : 'Send SMS') }}</button>
  @if (formError) {
    <p class="error" role="alert">{{ formError }}</p>
  }
</form>

@if (scheduled.length > 0) {
  <div class="scheduled">
    <h4>Scheduled sends</h4>
    <ul>
      @for (s of scheduled; track s.id) {
        <li>
          <div>
            <strong>{{ s.sendAt | date:'medium' }}</strong>
            <span class="muted"> · {{ s.total }} recipient{{ s.total === 1 ? '' : 's' }} · {{ s.status }}</span>
            <div class="muted small">{{ s.smsBody | slice:0:120 }}</div>
          </div>
          <span class="spacer"></span>
          @if (s.status === 'scheduled') {
            <button mat-button color="warn" type="button" (click)="cancelSchedule(s.id)" [disabled]="cancellingId === s.id">
              {{ cancellingId === s.id ? 'Cancelling…' : 'Cancel' }}
            </button>
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
        max-width: 280px;
    }
    .message-phone,
    .template-field {
        width: 100%;
    }
    .message-phone textarea {
        min-height: 110px;
    }

    button {
        min-height: 44px;
        margin-top: 4px;
        align-self: flex-start;
    }

    .send-row {
        width: 100%;
        display: flex;
        gap: 0.5em;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 12px;
    }

    .send-row button { width: auto; margin-top: 0; align-self: auto; }

    .schedule-field { min-width: 220px; }

    .scheduled {
        width: 100%;
        margin-top: 1.5em;
    }

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
        .sender-id {
            max-width: none;
        }
        button {
            width: 100%;
            align-self: stretch;
        }
    }
}

`,
providers: [SMSService],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [CommonModule, MatInputModule, MatButtonModule, MatSelectModule, FormsModule, ReactiveFormsModule, MatFormFieldModule]
})
export class EnterPhoneNumbersComponent implements OnInit, OnDestroy {
  @Input() partner!: PartnerInterface;
  bulckSMSForm!: FormGroup;
  subscriptions: Array<Subscription> = [];
  protected readonly templates = TEMPLATES;
  protected readonly leads = inject(LeadPipelineService);
  protected readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);

  sending = false;
  formError: string | null = null;
  sendMode: 'now' | 'later' = 'now';
  scheduledAt = '';
  scheduled: Array<{ id: string; total: number; smsBody: string; sendAt: string; status: string }> = [];
  cancellingId: string | null = null;

  constructor(
    private smsService: SMSService,
    private router: Router,
    private exportContactAndEmailService: ExportContactAndEmailService,
    private handoff: TemplateHandoffService
  ) { }


  ngOnInit(): void {
    this.bulckSMSForm = new FormGroup({
      senderId: new FormControl('C21FG', Validators.required),
      phoneNumbers: new FormControl('', Validators.required),
      textMessage: new FormControl('', Validators.required),
    });

    this.subscriptions.push(
      this.exportContactAndEmailService.data$.subscribe((data) => {
        const contactPhoneNumbers: Array<string> = data;
        if (contactPhoneNumbers && contactPhoneNumbers.length > 0 && this.bulckSMSForm) {
          // Patch numbers only — never wipe a typed message.
          this.bulckSMSForm.get('phoneNumbers')?.setValue(contactPhoneNumbers);
        }
      })
    );

    // One-shot template handoff from the content library (appended, never wiped).
    const handed = this.handoff.takeText();
    if (handed && this.bulckSMSForm) {
      const current = String(this.bulckSMSForm.get('textMessage')?.value ?? '').trim();
      this.bulckSMSForm.get('textMessage')?.setValue(
        ((current ? `${current}\n\n` : '') + handed).slice(0, 960));
    }

    if (this.partner?._id) {
      this.reloadScheduled();
    }
  }

  protected reloadScheduled(): void {
    this.subscriptions.push(
      this.smsService.listScheduled().subscribe({
        next: (res) => {
          this.scheduled = res?.data ?? [];
        },
        error: () => {},
      })
    );
  }

  get pages(): number {
    const messageLength = this.bulckSMSForm.get('textMessage')?.value.length || 0;
    return Math.ceil(messageLength / 160);
  }

  /** Raw entries as typed (for invalid counting). */
  private rawEntries(): string[] {
    const v = this.bulckSMSForm.get('phoneNumbers')?.value;
    const arr = typeof v === 'string' ? v.split(',') : Array.isArray(v) ? v : [];
    return arr.map((n) => String(n).trim()).filter(Boolean);
  }

  protected previewCount(): number {
    return this.formatPhoneNumbers(this.rawEntries()).length;
  }

  protected invalidCount(): number {
    return Math.max(0, this.rawEntries().length - this.previewCount());
  }

  protected previewCost(): number {
    return Math.round(this.previewCount() * this.pages * SMS_CHARGE_PER_PAGE * 100) / 100;
  }

  protected balance(): number {
    return Number(this.partner?.balance ?? 0);
  }

  protected canAfford(): boolean {
    return this.balance() >= this.previewCost();
  }

  protected applyTemplate(text: string): void {
    if (text) this.bulckSMSForm.get('textMessage')?.setValue(text);
  }

  onSubmit() {
    Object.keys(this.bulckSMSForm.controls).forEach((k) => this.bulckSMSForm.get(k)?.markAsTouched());
    if (!this.bulckSMSForm.valid || this.sending) return;
    const to = this.formatPhoneNumbers(this.rawEntries());
    const body = String(this.bulckSMSForm.get('textMessage')?.value ?? '').trim();
    if (to.length === 0) {
      this.formError = 'No valid Nigerian mobile numbers found.';
      return;
    }
    this.formError = null;
    if (this.sendMode === 'later') return this.schedule(to, body);
    const cost = Math.round(to.length * this.pages * SMS_CHARGE_PER_PAGE * 100) / 100;

    void this.ui.confirm({
      title: 'Send bulk SMS?',
      message: `${to.length} recipient${to.length === 1 ? '' : 's'} · ${this.pages} page${this.pages === 1 ? '' : 's'} · ₦${cost.toFixed(2)} will be charged.`,
      tone: 'warning',
      confirmText: 'Send SMS',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.sending = true;
      this.subscriptions.push(
        this.smsService.sendBulkSMS({ to, body }).subscribe({
          next: (response) => {
            this.sending = false;
            const data = response.data;
            const failedNote = data.failed.length > 0
              ? ` Failed: ${data.failed.map((f: { to: string }) => f.to).join(', ')}.`
              : '';
            const message = `SMS sent to ${data.sent} of ${data.total} recipients.${failedNote}`;
            data.status === 'failed' || data.failed.length > 0 ? this.ui.warning(message) : this.ui.success(message);
            this.mirrorToTimelines(to, body);
            this.bulckSMSForm.get('phoneNumbers')?.setValue('');
          },
          error: (error: ApiError) => {
            this.sending = false;
            this.formError = userError(error);
            this.ui.error(this.formError);
          },
        })
      );
    });
  }

  /** Later mode: validate the fire time, then queue (charged at send time). */
  private schedule(to: string[], body: string): void {
    const at = this.scheduledAt ? new Date(this.scheduledAt) : null;
    if (!at || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
      this.formError = 'Pick a future date and time for the scheduled send.';
      return;
    }
    this.sending = true;
    this.subscriptions.push(
      this.smsService.scheduleBulkSMS({
        to,
        body,
        sendAt: at.toISOString(),
      }).subscribe({
        next: () => {
          this.sending = false;
          this.bulckSMSForm.get('phoneNumbers')?.setValue('');
          this.scheduledAt = '';
          this.sendMode = 'now';
          this.reloadScheduled();
          this.ui.success(`SMS scheduled for ${at.toLocaleString()} — charged when it fires.`);
        },
        error: (error: ApiError) => {
          this.sending = false;
          this.formError = userError(error);
        },
      })
    );
  }

  protected cancelSchedule(id: string): void {
    if (this.cancellingId) return;
    this.cancellingId = id;
    this.subscriptions.push(
      this.smsService.cancelScheduled(id).subscribe({
        next: () => {
          this.cancellingId = null;
          this.reloadScheduled();
        },
        error: (error: ApiError) => {
          this.cancellingId = null;
          this.formError = userError(error);
        },
      })
    );
  }
  private mirrorToTimelines(to: string[], body: string): void {
    // Same identity the pipeline page uses, so mirrored touches land on
    // the prospects the member actually sees in My follow-ups.
    const id = String(this.auth.currentUser()?.id ?? this.partner?._id ?? '').trim();
    if (!id || to.length === 0) return;
    const keys = new Set(to.map(tail9).filter((k) => k.length >= 7));
    if (keys.size === 0) return;
    this.subscriptions.push(
      this.leads.listByPartner(id, { limit: 500 }).subscribe({
        next: (res) => {
          const hits = (res.data ?? [])
            .filter((p) => keys.has(tail9(p.prospectPhone)))
            .slice(0, MAX_LOG_MIRROR);
          const text = `Bulk SMS (${this.pages}p): ${body}`.slice(0, 5000);
          for (const hit of hits) {
            this.leads.logCommunication(hit.id, {
              type: 'text',
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

  private formatPhoneNumbers(numbers: string | string[]): string[] {
    // Initialize a Set to ensure uniqueness
    const uniqueNumbers = new Set<string>();

    // Determine how to process the input based on the provided category
    let numberArray: string[];

    if (typeof numbers === 'string') {
      // If the category is 'string', split the input string by commas and trim whitespace
      numberArray = (numbers as string).split(',').map(num => num.trim());
    } else if (Array.isArray(numbers)) {
      // If the category is 'array', ensure that it's properly typed
      numberArray = (numbers as string[]).map(num => num.trim());
    } else {
      throw new Error('Invalid category. Must be either a string or an array.');
    }

    numberArray.forEach(number => {
      // Validate and format phone number
      if (this.isValidNigerianNumber(number)) {
        // Format number to start with +234
        const formattedNumber = number.startsWith('0')
          ? '+234' + number.slice(1)  // Replace the initial 0 with +234
          : number.startsWith('+234')
            ? number                       // If it already starts with +234, keep it
            : '+234' + number;            // Otherwise, prepend +234
        uniqueNumbers.add(formattedNumber);
      }
    });

    // Return the unique, formatted phone numbers as an array
    return Array.from(uniqueNumbers);
  }

  private isValidNigerianNumber(number: string): boolean {
    // Simple regex for validating Nigerian phone numbers
    const regex = /^(0|\+234)[789]\d{9}$/;
    return regex.test(number);
  }


  ngOnDestroy() {
    // unsubscribe list
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
