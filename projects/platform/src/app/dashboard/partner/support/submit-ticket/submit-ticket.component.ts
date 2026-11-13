import { Component, inject, Input, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { PartnerInterface } from '../../../../_common/services/partner.service';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from '../../../../_common/help-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { TicketService } from './submit-ticket.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { HttpErrorResponse } from '@angular/common/http';
import { userError } from '../../../../core/http/api-error';
import { UiFeedbackService } from '../../../../core/ui/ui-feedback.service';

/**
 * @title Mentors Program
 */
@Component({
selector: 'async-submit-ticket',
template: `

<section class="breadcrumb-wrapper">
  <div class="breadcrumb">
    <a routerLink="/dashboard">Dashboard</a> &gt;
    <span>Support</span>
  </div>
</section>

<section class="support-page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Support · Help centre</p>
      <h1>How can we help?</h1>
      <p class="subtitle">Tell us what happened and the team will investigate. The more detail you share, the faster we can route your ticket to the right person.</p>
    </div>
    <button mat-stroked-button type="button" (click)="showDescription()">
      <mat-icon>help_outline</mat-icon>
      Support guide
    </button>
  </header>

  <div class="support-layout">
    <form class="ticket-card" [formGroup]="ticketForm" (ngSubmit)="onSubmit()">
      <div class="card-head">
        <span class="card-icon"><mat-icon>confirmation_number</mat-icon></span>
        <div>
          <h2>Submit a ticket</h2>
          <p>Required fields help us route your request without back-and-forth.</p>
        </div>
      </div>

      <section class="form-section">
        <h3>Issue details</h3>
        <div class="form-grid">
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Subject of the issue</mat-label>
            <input matInput formControlName="subject" required maxlength="120" placeholder="A short summary of the problem">
            @if (ticketForm.get('subject')?.hasError('required')) {
              <mat-error>This field is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category" required>
              <mat-option value="Technical Issue">Technical Issue</mat-option>
              <mat-option value="Feature Request">Feature Request</mat-option>
              <mat-option value="Feedback/Suggestion">Feedback/Suggestion</mat-option>
              <mat-option value="Account Issues">Account Issues</mat-option>
              <mat-option value="Billing/Payment Issues">Billing/Payment Issues</mat-option>
              <mat-option value="Usability Issue">Usability Issue</mat-option>
              <mat-option value="Performance Issues">Performance Issues</mat-option>
              <mat-option value="Bug Report">Bug Report</mat-option>
              <mat-option value="Accessibility Issue">Accessibility Issue</mat-option>
              <mat-option value="Security Concern">Security Concern</mat-option>
              <mat-option value="Onboarding/Setup Assistance">Onboarding/Setup Assistance</mat-option>
              <mat-option value="Integration Questions">Integration Questions</mat-option>
              <mat-option value="General Inquiry">General Inquiry</mat-option>
            </mat-select>
            @if (ticketForm.get('category')?.hasError('required')) {
              <mat-error>This field is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priority level</mat-label>
            <mat-select formControlName="priority" required>
              <mat-option value="Low">Low — general question</mat-option>
              <mat-option value="Medium">Medium — work is affected</mat-option>
              <mat-option value="High">High — blocked or urgent</mat-option>
            </mat-select>
            @if (ticketForm.get('priority')?.hasError('required')) {
              <mat-error>This field is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Date the issue occurred</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="date">
            <mat-hint>MMMM DD, YYYY</mat-hint>
            <mat-datepicker-toggle matIconSuffix [for]="dp"></mat-datepicker-toggle>
            <mat-datepicker #dp></mat-datepicker>
            @if (ticketForm.get('date')?.hasError('required')) {
              <mat-error>This field is required.</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Describe the challenge</mat-label>
          <textarea matInput formControlName="description" rows="5" required placeholder="What were you doing? What did you expect? What happened instead?"></textarea>
          <mat-hint>Include the steps you took and any error message you saw.</mat-hint>
          @if (ticketForm.get('description')?.hasError('required')) {
            <mat-error>This field is required.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Additional comments (optional)</mat-label>
          <textarea matInput formControlName="comment" rows="3" placeholder="Anything else that helps us understand the issue?"></textarea>
        </mat-form-field>
      </section>

      <div class="form-foot">
        <p class="muted">You will receive updates by email and in-app notification. Never include passwords or full card details.</p>
        <button mat-flat-button color="primary" type="submit">
          <mat-icon>send</mat-icon>
          Submit ticket
        </button>
      </div>
    </form>

    <aside class="support-aside">
      <section class="aside-card">
        <div class="aside-head">
          <span class="aside-icon"><mat-icon>route</mat-icon></span>
          <div><h3>What happens next</h3><p>From submission to resolution.</p></div>
        </div>
        <ol class="steps">
          <li>
            <span class="step-number">1</span>
            <div><strong>We review</strong><p>Your ticket is triaged by category and priority.</p></div>
          </li>
          <li>
            <span class="step-number">2</span>
            <div><strong>We investigate</strong><p>Support checks your account and reproduces the issue.</p></div>
          </li>
          <li>
            <span class="step-number">3</span>
            <div><strong>We follow up</strong><p>You get a clear answer or the next step by email and notification.</p></div>
          </li>
        </ol>
      </section>

      <section class="aside-card aside-card--tip">
        <div class="aside-head">
          <span class="aside-icon aside-icon--tip"><mat-icon>lightbulb</mat-icon></span>
          <div><h3>Before you submit</h3><p>A few checks can solve it faster.</p></div>
        </div>
        <ul class="tips">
          <li>Refresh the page and try the action once more.</li>
          <li>Check that your wallet or subscription is funded where relevant.</li>
          <li>Note the exact time, page and error message.</li>
          <li>For payment issues, include the transaction reference — never your card PIN.</li>
        </ul>
      </section>

      <section class="aside-card">
        <div class="aside-head">
          <span class="aside-icon"><mat-icon>menu_book</mat-icon></span>
          <div><h3>Quick links</h3><p>Answers without waiting for a reply.</p></div>
        </div>
        <div class="quick-links">
          <a mat-stroked-button routerLink="/dashboard/support/about/app">
            <mat-icon>info</mat-icon>
            About MarketSpase
          </a>
          <a mat-stroked-button routerLink="/dashboard/community/feed">
            <mat-icon>forum</mat-icon>
            Community feed
          </a>
        </div>
      </section>
    </aside>
  </div>
</section>

`,
styles: [`
  .breadcrumb-wrapper { margin-bottom: 16px; }
  .breadcrumb a { text-decoration: none; }
  .support-page { display: flex; flex-direction: column; gap: 24px; max-width: 1160px; margin: 0 auto; padding-bottom: 32px; }
  .page-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; }
  .page-head h1 { margin: 4px 0 8px; font-size: clamp(2rem, 3vw, 2.5rem); letter-spacing: -0.03em; }
  .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .subtitle { margin: 0; max-width: 60em; color: var(--ms-text-muted); line-height: 1.6; }
  .page-head button mat-icon { margin-right: 6px; }

  .support-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 0.85fr); gap: 24px; align-items: start; }
  .ticket-card { display: flex; flex-direction: column; gap: 24px; padding: 24px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); box-shadow: var(--ms-shadow-sm); }
  .card-head { display: flex; align-items: center; gap: 16px; }
  .card-icon { flex: none; width: 48px; height: 48px; border-radius: var(--ms-radius-lg); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
  .card-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }
  .card-head h2 { margin: 0 0 2px; font-size: 1.25rem; }
  .card-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.5; }

  .form-section { display: flex; flex-direction: column; gap: 16px; }
  .form-section h3 { margin: 0; font-size: 0.9375rem; }
  .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
  .span-2 { grid-column: 1 / -1; width: 100%; }
  .form-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-top: 1px solid var(--ms-line); padding-top: 16px; }
  .form-foot .muted { margin: 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; max-width: 46em; }
  .form-foot button { min-height: 48px; }
  .form-foot button mat-icon { margin-right: 6px; }

  .support-aside { display: flex; flex-direction: column; gap: 16px; }
  .aside-card { padding: 16px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); display: flex; flex-direction: column; gap: 12px; }
  .aside-card--tip { background: var(--ms-warning-soft); border-color: transparent; }
  .aside-head { display: flex; align-items: flex-start; gap: 12px; }
  .aside-head h3 { margin: 0 0 2px; font-size: 0.9375rem; }
  .aside-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; }
  .aside-card--tip .aside-head p { color: var(--ms-warning); }
  .aside-icon { flex: none; width: 36px; height: 36px; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
  .aside-icon--tip { background: rgba(255, 255, 255, 0.5); color: var(--ms-warning); }
  .aside-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .steps li { display: flex; align-items: flex-start; gap: 12px; }
  .step-number { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-canvas); color: var(--ms-primary-strong); font-size: 0.75rem; font-weight: 700; }
  .steps strong { display: block; font-size: 0.8125rem; font-weight: 600; }
  .steps p { margin: 1px 0 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
  .tips { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; color: var(--ms-warning); font-size: 0.8125rem; line-height: 1.5; }
  .quick-links { display: flex; flex-direction: column; gap: 8px; }
  .quick-links a { justify-content: flex-start; min-height: 44px; }
  .quick-links mat-icon { margin-right: 6px; }

  @media (max-width: 980px) {
    .support-layout { grid-template-columns: minmax(0, 1fr); }
    .support-aside { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .support-page { gap: 16px; }
    .ticket-card { padding: 16px; }
    .form-grid { grid-template-columns: minmax(0, 1fr); }
    .span-2 { grid-column: auto; }
    .support-aside { grid-template-columns: minmax(0, 1fr); }
    .form-foot button { width: 100%; }
  }
`],
providers: [TicketService],
changeDetection: ChangeDetectionStrategy.Eager,
imports: [MatIconModule, RouterModule, MatNativeDateModule, MatDatepickerModule, MatExpansionModule, MatFormFieldModule, MatButtonModule, FormsModule, MatInputModule, ReactiveFormsModule, MatSelectModule]
})
export class SubmitTicketComponent implements OnInit {
  readonly panelOpenState = signal(false);

    @Input() partner!: PartnerInterface;
    readonly dialog = inject(MatDialog);
  private readonly ui = inject(UiFeedbackService);

    ticketForm!: FormGroup;
    subscriptions: Array<Subscription> = [];

    constructor(
     private ticketService: TicketService,
      private router: Router,
    ) {}


    ngOnInit(): void {

        if (this.partner) {
          this.ticketForm = new FormGroup({
            subject: new FormControl('', Validators.required),
            description: new FormControl('', Validators.required),
            date: new FormControl('', Validators.required),
            category: new FormControl('', Validators.required),
            priority: new FormControl('', Validators.required),
            comment: new FormControl(''),
            partnerId: new FormControl(this.partner._id),
          });
        }
    }

    onSubmit() {
      const ticketObject = this.ticketForm.value;

      if (this.ticketForm.valid) {
        this.subscriptions.push(
          this.ticketService.submitTicket(ticketObject).subscribe({
            next: (response) => {
              this.ui.success(response.message || 'Your ticket has been submitted. We will follow up with updates.');
            },
            error: (error: HttpErrorResponse) => {
              this.ui.error(userError(error));
            }
          })
        )
      }
    }

    showDescription () {
      this.dialog.open(HelpDialogComponent, {
        data: {help: `
          Contact the application administrator for assistance, feedback, and suggestions for improvement.

          <p>Feel free to share any challenges you encounter while using the app, along with any suggestions for improvements or features you would like to see added.</p>
        `},
      });
    }

    ngOnDestroy() {
      // unsubscribe list
      this.subscriptions.forEach(subscription =>  subscription.unsubscribe());
    }
}
