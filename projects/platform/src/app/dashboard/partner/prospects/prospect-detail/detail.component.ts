import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { LeadPipelineService } from '../lead-pipeline/lead-pipeline.service';
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

/**
 * @title Prospect detail — bio, conversion journey, activity timeline.
 *
 * Single place to work a prospect: advance stage, log every touch,
 * convert with confidence. OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-prospect-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, MatButtonModule, MatChipsModule, MatDatepickerModule, MatIconModule, MatInputModule,
    MatSelectModule, MatTimepickerModule, PageSkeletonComponent, ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/prospects/pipeline">Pipeline</a> &gt;
        <span>{{ names() }}</span>
      </div>
    </section>

    <section class="detail-page">
      @if (loading()) {
        <async-page-skeleton layout="profile" [rows]="3" label="prospect" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert"><mat-icon>error_outline</mat-icon><p>{{ err }}</p><button mat-stroked-button type="button" (click)="reload()">Retry</button></div>
      }

      @if (convertedNotice(); as converted) {
        <div class="code-banner" role="status">
          <span class="banner-icon"><mat-icon>celebration</mat-icon></span>
          <div><strong>{{ converted.name }}</strong> is marked converted. Share your open registration or referral link so they can join.</div>
          <button mat-icon-button (click)="convertedNotice.set(null)" aria-label="Dismiss"><mat-icon>close</mat-icon></button>
        </div>
      }

      @if (lead(); as prospect) {
        <section class="prospect-hero">
          <span class="hero-avatar" aria-hidden="true">{{ initials() }}</span>
          <div class="hero-copy">
            <p class="eyebrow">Prospect · {{ prospect.prospectSource || 'Pipeline' }}</p>
            <h1>{{ names() }}</h1>
            <p class="hero-meta">{{ prospect.prospectPhone }} · {{ prospect.prospectEmail || 'No email' }} · joined {{ prospect.createdAt | date:'mediumDate' }}</p>
            <div class="hero-chips">
              <span class="stage-pill {{ stageTone() }}">{{ chip().label }}</span>
              @if (prospect.priority) { <span class="pill">{{ prospect.priority }} priority</span> }
              @if (prospect.relationship) { <span class="pill">{{ prospect.relationship }}</span> }
              <span class="pill">{{ prospect.consentToContact ? 'Contact agreed' : 'No contact consent' }}</span>
            </div>
          </div>
          <div class="hero-actions">
            @if (next(); as nxt) {
              <button mat-flat-button color="primary" type="button" (click)="advance(nxt)" [disabled]="acting()">Advance to {{ nxt }}</button>
            }
            @if (canConvert()) {
              @if (confirming()) {
                <button mat-flat-button color="accent" type="button" (click)="convert()" [disabled]="acting()">Confirm convert</button>
                <button mat-button type="button" (click)="confirming.set(false)">Cancel</button>
              } @else {
                <button mat-stroked-button type="button" (click)="confirming.set(true)">Convert</button>
              }
            }
            <button mat-stroked-button type="button" (click)="toggleLogForm()">{{ showLogForm() ? 'Close log' : 'Log activity' }}</button>
            <a mat-icon-button [routerLink]="['/dashboard/prospects/edit', prospectId()]" title="Edit prospect" aria-label="Edit prospect"><mat-icon>edit</mat-icon></a>
          </div>
        </section>

        @if (isDownline()) {
          <div class="downline-banner" role="note">
            <mat-icon>support_agent</mat-icon>
            <div><strong>Downline prospect — you're supporting this contact.</strong><span> Log activity and advance the stage on their behalf. Enrolment credit stays with the owner.</span></div>
          </div>
        }

        <section class="summary-strip" aria-label="Prospect summary">
          <div class="summary-card"><span class="summary-icon"><mat-icon>route</mat-icon></span><div><strong>{{ chip().label }}</strong><span>Current stage</span><small>{{ stuckDuration(daysInStage()) }} in stage</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--info"><mat-icon>forum</mat-icon></span><div><strong>{{ touchCount() }}</strong><span>Logged touches</span><small>Conversations and notes</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--warn"><mat-icon>schedule</mat-icon></span><div><strong>{{ daysInStage() }}d</strong><span>Days in stage</span><small>{{ stuckDuration(daysInStage()) }}</small></div></div>
          <div class="summary-card"><span class="summary-icon summary-icon--ok"><mat-icon>event</mat-icon></span><div><strong>{{ prospect.createdAt | date:'MMM d' }}</strong><span>Joined pipeline</span><small>{{ prospect.createdAt | date:'yyyy' }}</small></div></div>
        </section>

        <div class="detail-grid">
          <div class="detail-main">
            <section class="panel next-panel" aria-label="Next action">
              <div class="panel-head">
                <div><p class="eyebrow">Next move</p><h2>{{ next() ? 'Keep the conversation moving' : (isConverted() ? 'Converted prospect' : 'Choose the next step') }}</h2></div>
                @if (canClose()) { <button mat-button color="warn" type="button" (click)="advance('Closed')" [disabled]="acting()">Mark lost</button> }
              </div>
              <p class="panel-copy">
                @if (next(); as nxt) {
                  The natural next stage is <strong>{{ nxt }}</strong>. Advance when the conversation has earned it, then log the touch.
                } @else if (isConverted()) {
                  This prospect is enrolled. Keep supporting their first steps.
                } @else {
                  This prospect is closed. Reopen by editing the stage when there is a new opening.
                }
              </p>
              <div class="next-actions">
                @if (next(); as nxt) { <button mat-flat-button color="primary" type="button" (click)="advance(nxt)" [disabled]="acting()">Advance to {{ nxt }}</button> }
                @if (canConvert()) { <button mat-stroked-button type="button" (click)="confirming.set(true)">Convert prospect</button> }
                <button mat-stroked-button type="button" (click)="toggleLogForm()">{{ showLogForm() ? 'Close activity form' : 'Log a touch' }}</button>
              </div>
            </section>

            @if (showLogForm()) {
              <form class="log-form panel" [formGroup]="logForm" (ngSubmit)="saveLog()">
                <div class="panel-head"><div><p class="eyebrow">Activity</p><h2>Log a touch</h2></div><button mat-icon-button type="button" (click)="toggleLogForm()" aria-label="Close activity form"><mat-icon>close</mat-icon></button></div>
                <div class="two-col">
                  <mat-form-field appearance="outline">
                    <mat-label>Type</mat-label>
                    <mat-select formControlName="type">@for (t of commTypes; track t) { <mat-option [value]="t">{{ t }}</mat-option> }</mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Interest</mat-label>
                    <mat-select formControlName="interestLevel">@for (level of interestLevels; track level) { <mat-option [value]="level">{{ level }}</mat-option> }</mat-select>
                  </mat-form-field>
                </div>
                <div>
                  <span class="field-label" id="outcome-label">Outcome</span>
                  <div class="seg" role="radiogroup" aria-labelledby="outcome-label">
                    @for (o of commOutcomes; track o) {
                      <button type="button" class="seg-btn" [class.seg-btn--active]="logForm.get('outcome')?.value === o" [attr.aria-pressed]="logForm.get('outcome')?.value === o" (click)="pickOutcome(o)">{{ o }}</button>
                    }
                  </div>
                </div>
                <div class="two-col">
                  <mat-form-field appearance="outline"><mat-label>Date</mat-label><input matInput [matDatepicker]="logDatePicker" formControlName="date" /><mat-datepicker-toggle matSuffix [for]="logDatePicker" /><mat-datepicker #logDatePicker />@if (logForm.get('date')?.hasError('required') && logForm.get('date')?.touched) { <mat-error>Date is required</mat-error> }</mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Time</mat-label><input matInput [matTimepicker]="logTimePicker" formControlName="time" /><mat-timepicker-toggle matSuffix [for]="logTimePicker" /><mat-timepicker #logTimePicker interval="30m" />@if (logForm.get('time')?.hasError('required') && logForm.get('time')?.touched) { <mat-error>Time is required</mat-error> }</mat-form-field>
                </div>
                <div class="two-col">
                  <mat-form-field appearance="outline"><mat-label>Duration (min)</mat-label><input matInput type="number" min="0" formControlName="duration" /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Follow up by</mat-label><input matInput [matDatepicker]="followUpPicker" formControlName="followUpDate" placeholder="Pick a date" /><mat-datepicker-toggle matSuffix [for]="followUpPicker" /><mat-datepicker #followUpPicker />@if (logForm.get('followUpDate')?.hasError('required') && logForm.get('followUpDate')?.touched) { <mat-error>Pick when to follow up.</mat-error> }</mat-form-field>
                </div>
                <mat-form-field appearance="outline"><mat-label>What happened?</mat-label><textarea matInput rows="3" formControlName="description" maxlength="5000"></textarea></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Next action</mat-label><input matInput formControlName="followUpAction" maxlength="500" placeholder="e.g. Call Thursday with pricing" /></mat-form-field>
                <div class="form-actions">
                  <button mat-flat-button color="primary" type="submit" [disabled]="logForm.invalid || logging()">{{ logging() ? 'Saving…' : 'Save activity' }}</button>
                  @if (logError(); as err) { <span class="error" role="alert">{{ err }}</span> }
                </div>
              </form>
            }

            <section class="panel timeline-panel" aria-label="Activity timeline">
              <div class="panel-head"><div><p class="eyebrow">History</p><h2>Activity timeline</h2></div><span class="pill">{{ timeline().length }}</span></div>
              @if (timeline().length > 0) {
                <ol class="timeline">
                  @for (row of timeline(); track (row.kind === 'comm' ? (row.comm.id ?? row.comm.date) : (row.move.id ?? row.move.at)) ?? $index) {
                    @if (row.kind === 'comm') {
                      <li class="timeline-item">
                        <span class="timeline-icon"><mat-icon>{{ commIcon(row.comm.type) }}</mat-icon></span>
                        <div class="timeline-body">
                          <div class="timeline-top">
                            <strong>{{ row.comm.type }}</strong>
                            @if (row.comm.interestLevel) { <span class="mini-pill">{{ row.comm.interestLevel }}</span> }
                            @if (row.comm.outcome) { <span class="mini-pill mini-pill--info">{{ row.comm.outcome }}</span> }
                            @if (authorLabel(row.comm, prospect.partnerId); as by) { <span class="mini-pill">{{ by }}</span> }
                            <span class="muted">{{ row.comm.date | date:'medium' }}</span>
                          </div>
                          @if (row.comm.description) { <p>{{ row.comm.description }}</p> }
                          @if (row.comm.followUpAction || row.comm.followUpDate) {
                            <p class="muted">Next: {{ row.comm.followUpAction || '—' }}@if (row.comm.followUpDate) { · by {{ row.comm.followUpDate | date:'mediumDate' }}} @if (followUpOverdue(row.comm)) { <span class="overdue-pill">Overdue</span> }</p>
                          }
                        </div>
                      </li>
                    } @else {
                      <li class="timeline-item timeline-item--stage">
                        <span class="timeline-icon"><mat-icon>trending_up</mat-icon></span>
                        <div class="timeline-body">
                          <div class="timeline-top"><strong>{{ row.move.from || 'New' }} → {{ row.move.to }}</strong>@if (stageAuthorLabel(row.move, prospect.partnerId); as by) { <span class="mini-pill">{{ by }}</span> }<span class="muted">{{ row.move.at | date:'medium' }}</span></div>
                        </div>
                      </li>
                    }
                  }
                </ol>
              } @else {
                <div class="empty"><mat-icon>forum</mat-icon><p>No touches logged yet — log the first one above.</p></div>
              }
            </section>
          </div>

          <aside class="detail-aside">
            <section class="panel" aria-label="Contact context">
              <div class="panel-head"><div><p class="eyebrow">Context</p><h2>Contact details</h2></div><a mat-stroked-button [routerLink]="['/dashboard/prospects/edit', prospectId()]">Edit</a></div>
              <dl class="facts">
                <div><dt>Phone</dt><dd>{{ prospect.prospectPhone }}</dd></div>
                <div><dt>Email</dt><dd>{{ prospect.prospectEmail || '—' }}</dd></div>
                <div><dt>Relationship</dt><dd>{{ prospect.relationship || '—' }}</dd></div>
                <div><dt>Priority</dt><dd>{{ prospect.priority || '—' }}</dd></div>
                <div><dt>Best time</dt><dd>{{ prospect.bestTimeToCall || '—' }}</dd></div>
                <div><dt>Consent</dt><dd>{{ prospect.consentToContact ? 'Agreed' : 'No' }}</dd></div>
              </dl>
              @if (prospect.notes) { <p class="notes">{{ prospect.notes }}</p> } @else { <p class="fine">No notes yet — add context from Edit so your upline sees it here.</p> }
            </section>

            <section class="panel" aria-label="Journey">
              <div class="panel-head"><div><p class="eyebrow">Journey</p><h2>Pipeline facts</h2></div></div>
              <div class="fact-rows">
                <div><span>Source</span><strong>{{ prospect.prospectSource || '—' }}</strong></div>
                <div><span>Joined</span><strong>{{ prospect.createdAt | date:'mediumDate' }}</strong></div>
                <div><span>Stage age</span><strong>{{ stuckDuration(daysInStage()) }}</strong></div>
                <div><span>Touches</span><strong>{{ touchCount() }}</strong></div>
                <div><span>Stage</span><strong>{{ chip().label }}</strong></div>
              </div>
            </section>

            <section class="panel" aria-label="Actions">
              <div class="panel-head"><div><p class="eyebrow">Actions</p><h2>Work this prospect</h2></div></div>
              <div class="action-stack">
                @if (next(); as nxt) { <button mat-stroked-button type="button" (click)="advance(nxt)" [disabled]="acting()"><mat-icon>arrow_forward</mat-icon> Advance to {{ nxt }}</button> }
                @if (canConvert()) { <button mat-stroked-button type="button" (click)="confirming.set(true)"><mat-icon>verified</mat-icon> Convert</button> }
                <button mat-stroked-button type="button" (click)="toggleLogForm()"><mat-icon>post_add</mat-icon> Log activity</button>
                <a mat-stroked-button [routerLink]="['/dashboard/prospects/edit', prospectId()]"><mat-icon>edit</mat-icon> Edit contact</a>
                <a mat-stroked-button routerLink="/dashboard/prospects/reminders"><mat-icon>notification_important</mat-icon> Reminders</a>
              </div>
            </section>
          </aside>
        </div>
      }
    </section>
`,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 16px; }
    .breadcrumb a { text-decoration: none; }
    .detail-page { display: flex; flex-direction: column; gap: 24px; max-width: 1160px; margin: 0 auto; padding-bottom: 32px; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }

    .prospect-hero { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 24px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: linear-gradient(135deg, var(--ms-surface), var(--ms-primary-soft)); box-shadow: var(--ms-shadow-sm); }
    .hero-avatar { width: 64px; height: 64px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-family: var(--ms-font-display); font-size: 1.25rem; font-weight: 700; }
    .hero-copy { flex: 1; min-width: 240px; }
    .hero-copy h1 { margin: 4px 0; font-size: clamp(1.8rem, 3vw, 2.4rem); letter-spacing: -0.03em; text-transform: capitalize; }
    .hero-meta { margin: 0; color: var(--ms-text-muted); font-size: 0.8125rem; overflow-wrap: anywhere; }
    .hero-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .pill, .stage-pill { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: var(--ms-surface); border: 1px solid var(--ms-line); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: capitalize; white-space: nowrap; }
    .stage-pill { border-color: transparent; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .hero-actions button, .hero-actions a { min-height: 42px; }

    .downline-banner { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-info-soft); border: 1px solid var(--ms-info); color: var(--ms-text); font-size: 0.8125rem; line-height: 1.5; }
    .downline-banner mat-icon { color: var(--ms-primary-strong); flex: none; }
    .downline-banner span { color: var(--ms-text-muted); }

    .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .summary-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-md); }
    .summary-icon { width: 40px; height: 40px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .summary-icon--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .summary-icon--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .summary-icon--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-card > div { display: flex; flex-direction: column; gap: 1px; }
    .summary-card strong { font-family: var(--ms-font-display); font-size: 1.25rem; line-height: 1.1; font-variant-numeric: tabular-nums; text-transform: capitalize; }
    .summary-card span:last-of-type { color: var(--ms-text-muted); font-size: 0.75rem; font-weight: 600; }
    .summary-card small { color: var(--ms-text-muted); font-size: 0.6875rem; }

    .detail-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 0.75fr); gap: 24px; align-items: start; }
    .detail-main { display: flex; flex-direction: column; gap: 16px; }
    .detail-aside { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 96px; }
    .panel { padding: 24px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-surface); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.125rem; }
    .panel-copy { margin: 0; color: var(--ms-text-muted); font-size: 0.875rem; line-height: 1.6; }
    .next-panel { border-color: var(--ms-primary); }
    .next-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    .next-actions button { min-height: 44px; }

    .log-form { display: flex; flex-direction: column; gap: 12px; }
    .field-label { display: block; margin-bottom: 6px; font-size: 0.75rem; font-weight: 700; }
    .seg { display: flex; gap: 6px; flex-wrap: wrap; }
    .seg-btn { min-height: 40px; padding: 6px 14px; border: 1px solid var(--ms-line); border-radius: 999px; background: var(--ms-surface); color: var(--ms-text); font: inherit; font-size: 0.8125rem; cursor: pointer; }
    .seg-btn--active { border-color: var(--ms-primary); background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 700; }
    .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .two-col mat-form-field { width: 100%; }
    .form-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .form-actions button, .panel-head a, .action-stack a, .action-stack button { min-height: 40px; }

    .timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .timeline-item { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--ms-line); }
    .timeline-item:first-child { border-top: 0; }
    .timeline-icon { width: 32px; height: 32px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--ms-canvas); color: var(--ms-primary-strong); }
    .timeline-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .timeline-item--stage { background: var(--ms-info-soft); border-radius: var(--ms-radius-md); padding: 12px; margin: 4px 0; border-top: 0; }
    .timeline-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .timeline-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.8125rem; }
    .timeline-top strong { text-transform: capitalize; }
    .timeline-body p { margin: 2px 0 0; font-size: 0.8125rem; line-height: 1.55; white-space: pre-wrap; }
    .mini-pill { padding: 3px 8px; border-radius: 999px; background: var(--ms-canvas); color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: capitalize; }
    .mini-pill--info { background: var(--ms-info-soft); color: var(--ms-primary-strong); }
    .overdue-pill { padding: 2px 7px; border-radius: 999px; background: var(--ms-warning-soft); color: var(--ms-warning); font-size: 0.6875rem; font-weight: 700; }
    .muted { color: var(--ms-text-muted); font-size: 0.75rem; }

    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin: 0; }
    .facts div { min-width: 0; }
    .facts dt { color: var(--ms-text-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .facts dd { margin: 2px 0 0; font-size: 0.8125rem; overflow-wrap: anywhere; text-transform: capitalize; }
    .notes { margin: 12px 0 0; padding: 12px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); font-size: 0.8125rem; line-height: 1.6; white-space: pre-wrap; }
    .fine { margin: 12px 0 0; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.5; }
    .fact-rows { display: flex; flex-direction: column; }
    .fact-rows div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-top: 1px solid var(--ms-line); }
    .fact-rows div:first-child { border-top: 0; }
    .fact-rows span { color: var(--ms-text-muted); font-size: 0.75rem; }
    .fact-rows strong { font-size: 0.8125rem; text-align: right; text-transform: capitalize; }
    .action-stack { display: flex; flex-direction: column; gap: 8px; }
    .action-stack button, .action-stack a { justify-content: flex-start; }
    .action-stack mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
    .empty { display: flex; align-items: center; gap: 8px; padding: 16px; border-radius: var(--ms-radius-md); background: var(--ms-canvas); color: var(--ms-text-muted); }
    .empty mat-icon { color: var(--ms-success); }
    .empty p { margin: 0; font-size: 0.8125rem; }
    .code-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-success-soft); border: 1px solid var(--ms-success); flex-wrap: wrap; }
    .banner-icon { width: 36px; height: 36px; flex: none; border-radius: var(--ms-radius-md); display: grid; place-items: center; background: var(--ms-surface); }
    .code-banner > div { flex: 1; min-width: 220px; font-size: 0.8125rem; line-height: 1.5; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--ms-radius-lg); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { flex: 1; margin: 0; }
    .error { color: var(--ms-error); }
    @media (max-width: 1000px) { .detail-grid { grid-template-columns: minmax(0, 1fr); } .detail-aside { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 700px) { .panel { padding: 16px; } .detail-aside { grid-template-columns: minmax(0, 1fr); } .summary-strip { grid-template-columns: minmax(0, 1fr); } .two-col { grid-template-columns: minmax(0, 1fr); } .facts { grid-template-columns: minmax(0, 1fr); } .hero-actions { width: 100%; } .hero-actions button, .hero-actions a { flex: 1; justify-content: center; } }
`],
})
export class ProspectDetailComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
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

  protected initials(): string {
    const lead = this.lead();
    const parts = `${lead?.prospectName ?? ''} ${lead?.prospectSurname ?? ''}`.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return `${first}${last}`.toUpperCase();
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
        },
        error: (err: ApiError) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
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
