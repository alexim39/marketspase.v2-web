import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { AdminPartnerSurveysService, PartnerSurveyRow, PartnerSurveyList } from './admin-partner-surveys.service';
import { ApiError, userError } from '../../../core/http/api-error';
import { timeAgo } from '../../../_common/date-util';

/**
 * @title Partner surveys — admin analytics for the public :4202 form.
 *
 * Source of truth for "what pains partners, what to fix next": KPIs +
 * ranked pain points (challenges/difficulty), leverage (strategies/tools/
 * audiences) and training demand, plus row inspect + hard delete (two-step,
 * audited server-side). Raw partner emails route to the owner inbox; this
 * desk is the analytics + moderation surface.
 */
@Component({
  selector: 'async-admin-partner-surveys',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe, FormsModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule,
    MatTableModule, RouterModule,
  ],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <a>Admin</a> &gt;
        <span>Partner surveys</span>
      </div>
    </section>

    <section class="page">
      <div class="page-head">
        <div>
          <h2>Partner surveys</h2>
          <p class="subtitle">Public :4202 submissions — pain-point analytics to improve the platform, plus inspect and hard-delete.</p>
        </div>
      </div>

      @if (notice(); as note) {
        <p class="notice" role="status">{{ note }}</p>
      }
      @if (loading() && rows().length === 0) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }
      @if (error(); as err) {
        <p class="error" role="alert">{{ err }} <button mat-button (click)="reload()">Retry</button></p>
      }

      @if (summary(); as s) {
        <div class="kpi-grid">
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>assignment</mat-icon>
            <span class="kpi-value">{{ s.total | number }}</span>
            <span class="kpi-label">Submissions</span>
          </mat-card-content></mat-card>
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>fiber_new</mat-icon>
            <span class="kpi-value">{{ s.new7d | number }}</span>
            <span class="kpi-label">New 7d</span>
          </mat-card-content></mat-card>
          <mat-card class="kpi"><mat-card-content>
            <mat-icon>school</mat-icon>
            <span class="kpi-value">{{ s.wantsTraining | number }}</span>
            <span class="kpi-label">Want training</span>
          </mat-card-content></mat-card>
        </div>
        <div class="rank-grid">
          <mat-card><mat-card-content>
            <h4>Top pain points (challenges)</h4>
            @for (r of s.topChallenges; track r.label) {
              <div class="rank"><span>{{ r.label }}</span><strong>{{ r.count }}</strong></div>
            } @empty { <p class="muted">No data yet.</p> }
          </mat-card-content></mat-card>
          <mat-card><mat-card-content>
            <h4>What they tried (strategies)</h4>
            @for (r of s.topStrategies; track r.label) {
              <div class="rank"><span>{{ r.label }}</span><strong>{{ r.count }}</strong></div>
            } @empty { <p class="muted">No data yet.</p> }
          </mat-card-content></mat-card>
          <mat-card><mat-card-content>
            <h4>Recruitment tools in use</h4>
            @for (r of s.byTool; track r.label) {
              <div class="rank"><span>{{ r.label }}</span><strong>{{ r.count }}</strong></div>
            } @empty { <p class="muted">No data yet.</p> }
          </mat-card-content></mat-card>
          <mat-card><mat-card-content>
            <h4>Training demand</h4>
            @for (r of s.trainingDemand; track r.label) {
              <div class="rank"><span>{{ r.label }}</span><strong>{{ r.count }}</strong></div>
            } @empty { <p class="muted">No data yet.</p> }
          </mat-card-content></mat-card>
        </div>
      }

      <div class="toolbar">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-label>Search name or phone</mat-label>
          <input matInput type="search" [(ngModel)]="query" (keyup.enter)="skip.set(0); reload()" maxlength="80" />
        </mat-form-field>
        <button mat-button (click)="skip.set(0); reload()">Apply</button>
      </div>

      @if (rows().length > 0) {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="mat-elevation-z2">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Partner</th>
              <td mat-cell *matCellDef="let row" class="name-cell">{{ row.name }} <span class="muted">{{ row.gender }}</span></td>
            </ng-container>
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact</th>
              <td mat-cell *matCellDef="let row">
                <div>{{ row.phoneNumber || '—' }}</div>
                <div class="muted">{{ row.reservationCode ? 'legacy code on file' : '' }}</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="pain">
              <th mat-header-cell *matHeaderCellDef>Top pain</th>
              <td mat-cell *matCellDef="let row">{{ (row.challenges?.[0] ?? row.difficulty) || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="age">
              <th mat-header-cell *matHeaderCellDef>Submitted</th>
              <td mat-cell *matCellDef="let row">{{ ageOf(row) }}</td>
            </ng-container>
            <ng-container matColumnDef="manage">
              <th mat-header-cell *matHeaderCellDef>Manage</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="inspect(row)">Inspect</button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        </div>
        <div class="pager">
          <button mat-button (click)="page(-1)" [disabled]="skip() === 0 || loading()">Previous</button>
          <span class="muted">{{ total() }} submissions</span>
          <button mat-button (click)="page(1)" [disabled]="skip() + limit() >= total() || loading()">Next</button>
        </div>
      } @else if (!loading() && !error()) {
        <p class="empty">No submissions match — clear the search.</p>
      }

      @if (inspected(); as lead) {
        <div class="dp-card detail-card" role="region" aria-label="Survey details">
          <h3>{{ lead.name }} <span class="muted">{{ lead.phoneNumber }}</span></h3>
          <div class="answers">
            <div class="answer"><span class="muted">Difficulty</span><strong>{{ lead.difficulty || '—' }}</strong></div>
            <div class="answer"><span class="muted">Challenges</span><strong>{{ lead.challenges?.join(', ') || '—' }}</strong></div>
            <div class="answer"><span class="muted">Strategies tried</span><strong>{{ lead.strategies?.join(', ') || '—' }}</strong></div>
            <div class="answer"><span class="muted">Target audience</span><strong>{{ lead.targetAudience?.join(', ') || '—' }}</strong></div>
            <div class="answer"><span class="muted">Recruitment tool</span><strong>{{ lead.recruitmentTool || '—' }}</strong></div>
            <div class="answer"><span class="muted">Misconception</span><strong>{{ lead.misconception || '—' }}</strong></div>
            <div class="answer"><span class="muted">Motivation</span><strong>{{ lead.businessMotivation || '—' }}</strong></div>
            <div class="answer"><span class="muted">Recruitment attempt</span><strong>{{ lead.recruitmentAttempt || '—' }}</strong></div>
            <div class="answer"><span class="muted">Training support needed</span><strong>{{ lead.trainingSupport || '—' }}</strong></div>
            <div class="answer"><span class="muted">Tech comfort</span><strong>{{ lead.comfortWithTech || '—' }}</strong></div>
            <div class="answer"><span class="muted">Time available</span><strong>{{ lead.businessTimeDedication || '—' }}</strong></div>
            <div class="answer"><span class="muted">Wants training</span><strong>{{ lead.interestedInTraining || '—' }}</strong></div>
          </div>
          @if (actionError(); as aerr) {
            <p class="error" role="alert">{{ aerr }}</p>
          }
          <div class="row">
            @if (confirmDelete() === lead.id) {
              <span class="muted">Hard delete removes this survey row permanently.</span>
              <button mat-flat-button color="warn" (click)="remove(lead)" [disabled]="acting()">Confirm hard delete</button>
              <button mat-button (click)="confirmDelete.set(null)">Back</button>
            } @else {
              <button mat-button color="warn" (click)="confirmDelete.set(lead.id)">Hard delete</button>
            }
            <button mat-button (click)="inspected.set(null)">Close</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); max-width: 48em; }
    .notice { color: var(--ms-success); }
    .error { color: var(--ms-error); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75em; }
    .kpi mat-card-content { display: flex; flex-direction: column; gap: 0.2em; }
    .kpi mat-icon { color: var(--ms-primary-strong); }
    .kpi-value { font-size: 1.5em; font-weight: 700; }
    .kpi-label { color: var(--ms-text-muted); font-size: 0.85em; }
    .rank-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75em; }
    .rank-grid h4 { margin: 0 0 0.5em; }
    .rank { display: flex; justify-content: space-between; gap: 0.5em; padding: 0.25em 0; border-top: 1px solid var(--ms-line); font-size: 0.9em; }
    .toolbar { display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; }
    .toolbar .search-field { flex: 1 1 220px; }
    .table-wrap { overflow-x: auto; border-radius: 8px; }
    table { width: 100%; }
    .name-cell { font-weight: 600; }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    .pager { display: flex; align-items: center; gap: 1em; }
    .empty { color: var(--ms-text-muted); }
    .detail-card { padding: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .detail-card h3 { margin: 0; }
    .answers { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.5em; }
    .answer { display: flex; flex-direction: column; gap: 0.1em; border-left: 3px solid var(--ms-line); padding-left: 0.6em; }
    .row { display: flex; gap: 0.5em; flex-wrap: wrap; align-items: center; }
    button { min-height: 44px; }
  `],
})
export class AdminPartnerSurveysComponent implements OnInit {
  private readonly surveys = inject(AdminPartnerSurveysService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = ['name', 'contact', 'pain', 'age', 'manage'];
  protected readonly rows = signal<PartnerSurveyRow[]>([]);
  protected readonly total = signal(0);
  protected readonly summary = signal<PartnerSurveyList['summary'] | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly limit = signal(25);
  protected readonly skip = signal(0);
  protected query = '';
  protected readonly inspected = signal<PartnerSurveyRow | null>(null);
  protected readonly acting = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly confirmDelete = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.surveys
      .list({ ...(this.query.trim() ? { q: this.query.trim() } : {}), limit: this.limit(), skip: this.skip() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data?.items ?? []);
          this.total.set(res.data?.total ?? 0);
          this.summary.set(res.data?.summary ?? null);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(userError(err));
          this.loading.set(false);
        },
      });
  }

  protected page(direction: 1 | -1): void {
    this.skip.set(Math.max(0, this.skip() + direction * this.limit()));
    this.reload();
  }

  protected ageOf(row: PartnerSurveyRow): string {
    return row.createdAt ? timeAgo(new Date(row.createdAt)) : '—';
  }

  protected inspect(row: PartnerSurveyRow): void {
    this.inspected.set(row);
    this.actionError.set(null);
    this.confirmDelete.set(null);
  }

  protected remove(lead: PartnerSurveyRow): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.actionError.set(null);
    this.surveys
      .remove(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.acting.set(false);
          this.confirmDelete.set(null);
          this.inspected.set(null);
          this.notice.set(res.message ?? 'Survey hard-deleted.');
          this.reload();
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.actionError.set(userError(err));
        },
      });
  }
}
