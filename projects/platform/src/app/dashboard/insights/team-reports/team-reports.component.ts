import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ReportService } from '../../../core/reports/report.service';
import { AvatarComponent } from '../../../_common/avatar.component';
import { DownlineOption, PeriodReport, ReportRequest } from '../../../core/reports/report.models';
import { ApiError, userError } from '../../../core/http/api-error';

const toInputDate = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * @title Team reports — submit to upline, answer requests, read the team.
 *
 * Reports flow up to the direct upline; leaders request from their
 * downline and read what the team submitted. OnPush + signals, typed.
 */
@Component({
  selector: 'async-team-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent, DatePipe, MatButtonModule, MatChipsModule, MatDatepickerModule, MatNativeDateModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule,
    ReactiveFormsModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a routerLink="/dashboard/insights">Insights</a> &gt;
        <span>Team Reports</span>
      </div>
    </section>

    <section class="reports-page">
      <div class="page-head">
        <div>
          <h2>Team Reports</h2>
          <p class="subtitle">Report up to your upline — request and read from your downline.</p>
        </div>
        <div class="head-actions">
          <button mat-button (click)="toggleSubmit()">{{ showSubmit() ? 'Cancel' : 'Write report' }}</button>
          <button mat-button (click)="toggleRequest()">{{ showRequest() ? 'Cancel' : 'Request report' }}</button>
          <button mat-button (click)="print()">Print / PDF</button>
        </div>
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

      @if (incoming().length > 0) {
        <h3>Asked of you ({{ incoming().length }})</h3>
        <ul class="card-list">
          @for (req of incoming(); track req.id) {
            <li class="card">
              <div class="card-top">
                <strong>{{ req.requester?.name ?? 'Your upline' }} asked for a report</strong>
                <mat-chip color="warn" highlighted>Open request</mat-chip>
              </div>
              <p class="muted">{{ req.periodStart | date:'mediumDate' }} → {{ req.periodEnd | date:'mediumDate' }}</p>
              @if (req.note) {
                <p>"{{ req.note }}"</p>
              }
              <button mat-button (click)="answer(req)">Answer with a report</button>
            </li>
          }
        </ul>
      }

      @if (showSubmit()) {
        <form class="report-form" [formGroup]="submitForm" (ngSubmit)="saveReport()">
          <h3>{{ answering()?.id ? 'Answering request' : 'New report to your upline' }}</h3>
          @if (answering(); as req) {
            <p class="muted">Fulfils the request for {{ req.periodStart | date:'mediumDate' }} → {{ req.periodEnd | date:'mediumDate' }}</p>
          }
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Week 36 progress" maxlength="120" />
          </mat-form-field>
          <div class="two-col">
            <mat-form-field appearance="outline">
              <mat-label>Period start</mat-label>
              <input matInput [matDatepicker]="submitStartPicker" formControlName="periodStart" />
              <mat-datepicker-toggle matSuffix [for]="submitStartPicker" />
              <mat-datepicker #submitStartPicker />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Period end</mat-label>
              <input
                matInput
                [matDatepicker]="submitEndPicker"
                formControlName="periodEnd"
                [min]="submitForm.controls.periodStart.value"
              />
              <mat-datepicker-toggle matSuffix [for]="submitEndPicker" />
              <mat-datepicker #submitEndPicker />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline">
            <mat-label>Highlights</mat-label>
            <textarea matInput rows="4" formControlName="highlights" placeholder="Wins, numbers, recruits, sales…"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Blockers (optional)</mat-label>
            <textarea matInput rows="2" formControlName="blockers"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Plans (optional)</mat-label>
            <textarea matInput rows="2" formControlName="plans" placeholder="Next period's focus…"></textarea>
          </mat-form-field>
          <div class="form-actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="submitForm.invalid || saving()">
              {{ saving() ? 'Submitting…' : 'Submit to upline' }}
            </button>
            @if (submitError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        </form>
      }

      @if (showRequest()) {
        <form class="report-form" [formGroup]="requestForm" (ngSubmit)="sendRequest()">
          <h3>Request a report from your downline</h3>
          <mat-form-field appearance="outline">
            <mat-label>Downline partner</mat-label>
            <mat-select formControlName="downlineId">
              @for (d of downline(); track d.id) {
                <mat-option [value]="d.id">{{ d.name }} ({{ d.username }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <div class="two-col">
            <mat-form-field appearance="outline">
              <mat-label>Period start</mat-label>
              <input matInput [matDatepicker]="requestStartPicker" formControlName="periodStart" />
              <mat-datepicker-toggle matSuffix [for]="requestStartPicker" />
              <mat-datepicker #requestStartPicker />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Period end</mat-label>
              <input
                matInput
                [matDatepicker]="requestEndPicker"
                formControlName="periodEnd"
                [min]="requestForm.controls.periodStart.value"
              />
              <mat-datepicker-toggle matSuffix [for]="requestEndPicker" />
              <mat-datepicker #requestEndPicker />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline">
            <mat-label>Note (optional)</mat-label>
            <input matInput formControlName="note" maxlength="500" placeholder="What should they focus on?" />
          </mat-form-field>
          <div class="form-actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="requestForm.invalid || requesting()">
              {{ requesting() ? 'Sending…' : 'Send request' }}
            </button>
            @if (requestError(); as err) {
              <span class="error" role="alert">{{ err }}</span>
            }
          </div>
        </form>
      }

      <h3>Your reports ({{ mine().length }})</h3>
      @if (mine().length > 0) {
        <ul class="card-list">
          @for (rep of mine(); track rep.id) {
            <li class="card">
              <div class="card-top">
                <strong>{{ rep.title }}</strong>
                <span class="muted">{{ rep.createdAt | date:'mediumDate' }}</span>
              </div>
              <p class="muted">{{ rep.periodStart | date:'mediumDate' }} → {{ rep.periodEnd | date:'mediumDate' }}</p>
              <p>{{ rep.highlights }}</p>
              @if (rep.blockers) {
                <p><strong>Blockers:</strong> {{ rep.blockers }}</p>
              }
              @if (rep.plans) {
                <p><strong>Plans:</strong> {{ rep.plans }}</p>
              }
            </li>
          }
        </ul>
      } @else if (!loading()) {
        <p class="empty">Nothing submitted yet.</p>
      }

      <h3>Team reports ({{ team().length }})</h3>
      @if (team().length > 0) {
        <ul class="card-list">
          @for (rep of team(); track rep.id) {
            <li class="card">
              <div class="card-top">
                <strong>{{ rep.title }}</strong>
                <mat-chip highlighted><async-avatar [photo]="rep.author?.profileImage" [name]="rep.author?.name ?? 'Team member'" size="xs" />{{ rep.author?.name ?? 'Team member' }}</mat-chip>
              </div>
              <p class="muted">{{ rep.periodStart | date:'mediumDate' }} → {{ rep.periodEnd | date:'mediumDate' }}</p>
              <p>{{ rep.highlights }}</p>
              @if (rep.blockers) {
                <p><strong>Blockers:</strong> {{ rep.blockers }}</p>
              }
              @if (rep.plans) {
                <p><strong>Plans:</strong> {{ rep.plans }}</p>
              }
            </li>
          }
        </ul>
      } @else if (!loading()) {
        <p class="empty">Your downline hasn't submitted anything yet — request a report above.</p>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .reports-page { display: flex; flex-direction: column; gap: 1em; }
    .reports-page h3 { margin: 0.5em 0 0; }
    .page-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .head-actions { display: flex; gap: 0.25em; flex-wrap: wrap; }
    .head-actions a, .head-actions button { min-height: 44px; }
    .card-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6em; }
    .card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 0.9em 1em; display: flex; flex-direction: column; gap: 0.35em; }
    .card p { margin: 0; }
    .card-top { display: flex; justify-content: space-between; align-items: center; gap: 0.6em; flex-wrap: wrap; }
    .report-form { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 10px; padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .report-form h3 { margin: 0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75em; }
    @media only screen and (max-width: 600px) {
      .two-col { grid-template-columns: 1fr; }
    }
    .form-actions { display: flex; align-items: center; gap: 0.75em; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .error { color: var(--ms-error); }
    .empty { color: var(--ms-text-muted); }
  `],
})
export class TeamReportsComponent implements OnInit {
  private readonly reports = inject(ReportService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly requesting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly requestError = signal<string | null>(null);
  protected readonly showSubmit = signal(false);
  protected readonly showRequest = signal(false);
  protected readonly answering = signal<ReportRequest | null>(null);
  protected readonly incoming = signal<ReportRequest[]>([]);
  protected readonly mine = signal<PeriodReport[]>([]);
  protected readonly team = signal<PeriodReport[]>([]);
  protected readonly downline = signal<DownlineOption[]>([]);

  protected readonly submitForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    periodStart: [new Date(Date.now() - 6 * 86400000), Validators.required],
    periodEnd: [new Date(), Validators.required],
    highlights: ['', [Validators.required, Validators.maxLength(5000)]],
    blockers: [''],
    plans: [''],
  });

  protected readonly requestForm = this.fb.nonNullable.group({
    downlineId: ['', Validators.required],
    periodStart: [new Date(Date.now() - 6 * 86400000), Validators.required],
    periodEnd: [new Date(), Validators.required],
    note: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    this.reload();
  }

  protected print(): void {
    window.print();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      incoming: this.reports.incoming(),
      mine: this.reports.mine(),
      team: this.reports.team(),
      downline: this.reports.downline(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ incoming, mine, team, downline }) => {
          this.incoming.set(incoming.data ?? []);
          this.mine.set(mine.data ?? []);
          this.team.set(team.data ?? []);
          this.downline.set(downline.data ?? []);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected toggleSubmit(): void {
    this.showSubmit.set(!this.showSubmit());
    if (!this.showSubmit()) this.answering.set(null);
    this.submitError.set(null);
  }

  protected toggleRequest(): void {
    this.showRequest.set(!this.showRequest());
    this.requestError.set(null);
  }

  protected answer(req: ReportRequest): void {
    this.answering.set(req);
    this.submitForm.patchValue({
      periodStart: new Date(req.periodStart),
      periodEnd: new Date(req.periodEnd),
    });
    this.showSubmit.set(true);
    this.submitError.set(null);
  }

  protected saveReport(): void {
    if (this.submitForm.invalid) return;
    this.saving.set(true);
    this.submitError.set(null);
    const v = this.submitForm.getRawValue();
    const req = this.answering();
    this.reports
      .submit({
        title: v.title.trim(),
        periodStart: toInputDate(v.periodStart),
        periodEnd: toInputDate(v.periodEnd),
        highlights: v.highlights.trim(),
        blockers: v.blockers.trim(),
        plans: v.plans.trim(),
        ...(req ? { requestId: req.id } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showSubmit.set(false);
          this.answering.set(null);
          this.submitForm.reset({
            title: '',
            periodStart: new Date(Date.now() - 6 * 86400000),
            periodEnd: new Date(),
            highlights: '',
            blockers: '',
            plans: '',
          });
          this.reload();
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.submitError.set(userError(err));
        },
      });
  }

  protected sendRequest(): void {
    if (this.requestForm.invalid) return;
    this.requesting.set(true);
    this.requestError.set(null);
    const v = this.requestForm.getRawValue();
    this.reports
      .request(v.downlineId, toInputDate(v.periodStart), toInputDate(v.periodEnd), v.note.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.requesting.set(false);
          this.showRequest.set(false);
          this.reload();
        },
        error: (err: ApiError) => {
          this.requesting.set(false);
          this.requestError.set(userError(err));
        },
      });
  }
}
