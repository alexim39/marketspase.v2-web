import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { LeadPipelineService } from '../prospects/lead-pipeline/lead-pipeline.service';
import {
  ProspectLead,
  ProspectStage,
  ReminderEntry,
  RemindersData,
} from '../prospects/lead-pipeline/lead.models';
import { ApiError, userError } from '../../../core/http/api-error';

const STAGE_ORDER: ProspectStage[] = ['New', 'Contacted', 'Interested', 'In Negotiation', 'Converted', 'Closed'];

interface StageRow {
  stage: ProspectStage;
  count: number;
  percent: number;
}

/**
 * Pipeline hub — the daily sales engine landing. Surfaces follow-ups due,
 * stage mix and the quickest paths into each pipeline view. Reads the
 * existing `/v1/prospects` endpoints; no new backend contracts.
 */
@Component({
  selector: 'async-pipeline-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterModule,
  ],
  template: `
    <section class="pipeline-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Pipeline · Daily sales engine</p>
          <h1>Who needs you today</h1>
          <p class="muted">Follow-ups, deal board, page leads and the shared pool in one place.</p>
        </div>
        <div class="head-actions">
          <a mat-flat-button color="primary" routerLink="/dashboard/prospects/pipeline">Open pipeline</a>
          <a mat-stroked-button routerLink="/dashboard/tools/contacts/new">Add prospect</a>
        </div>
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      <div class="metrics">
        <div class="metric metric--urgent">
          <span>Overdue</span>
          <strong>{{ reminders()?.overdue?.length ?? 0 }}</strong>
          <a routerLink="/dashboard/prospects/reminders">Review</a>
        </div>
        <div class="metric">
          <span>Due today</span>
          <strong>{{ reminders()?.today?.length ?? 0 }}</strong>
          <a routerLink="/dashboard/prospects/reminders">Review</a>
        </div>
        <div class="metric">
          <span>Upcoming</span>
          <strong>{{ reminders()?.upcoming?.length ?? 0 }}</strong>
          <span class="metric-note">Scheduled</span>
        </div>
        <div class="metric">
          <span>Prospects</span>
          <strong>{{ prospectTotal() | number }}</strong>
          <a routerLink="/dashboard/prospects/pipeline">Open list</a>
        </div>
      </div>

      <div class="columns">
        <div class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Focus</p>
              <h2>Follow-ups due now</h2>
            </div>
            <a mat-button routerLink="/dashboard/prospects/reminders">All reminders</a>
          </div>

          @if (followUps().length === 0) {
            <div class="empty">
              <mat-icon>task_alt</mat-icon>
              <p>No follow-ups due. Add a prospect or move a deal forward to keep momentum.</p>
              <a mat-flat-button color="primary" routerLink="/dashboard/prospects/pipeline">Open pipeline</a>
            </div>
          } @else {
            <ul class="follow-list">
              @for (item of followUps(); track item.prospectId) {
                <li>
                  <div class="follow-main">
                    <strong>{{ item.name || 'Prospect' }}</strong>
                    <span class="muted">{{ item.followUpDate | date: 'mediumDate' }}</span>
                  </div>
                  @if (item.daysOverdue > 0) {
                    <span class="pill pill--late">{{ item.daysOverdue }}d overdue</span>
                  } @else {
                    <span class="pill">Due today</span>
                  }
                  <a mat-button [routerLink]="['prospects/detail', item.prospectId]">Open</a>
                </li>
              }
            </ul>
          }
        </div>

        <aside class="side">
          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Health</p>
                <h2>Stage mix</h2>
              </div>
              <span class="count">{{ prospectTotal() | number }}</span>
            </div>
            @if (stageRows().length === 0) {
              <p class="muted empty-line">No prospects yet — add someone or claim from the pool.</p>
            } @else {
              <div class="stage-list">
                @for (row of stageRows(); track row.stage) {
                  <div class="stage-row">
                    <span class="stage-label">{{ row.stage }}</span>
                    <div class="stage-track"><span [style.width.%]="row.percent"></span></div>
                    <strong>{{ row.count }}</strong>
                  </div>
                }
              </div>
            }
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Shortcuts</p>
                <h2>Work the pipeline</h2>
              </div>
            </div>
            <div class="quick-grid">
              <a routerLink="/dashboard/prospects/board"><mat-icon>view_kanban</mat-icon><span>Deal board</span></a>
              <a routerLink="/dashboard/prospects/personal-list"><mat-icon>inbox</mat-icon><span>Page leads</span></a>
              <a routerLink="/dashboard/prospects/bookings"><mat-icon>event</mat-icon><span>Sessions</span></a>
              <a routerLink="/dashboard/prospects/kits"><mat-icon>present_to_all</mat-icon><span>Presentations</span></a>
              <a routerLink="/dashboard/tools/contacts/new"><mat-icon>person_add</mat-icon><span>Add someone</span></a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    .pipeline-page { max-width: 1180px; margin: 0 auto; padding: 24px 0 48px; display: flex; flex-direction: column; gap: 16px; }
    .page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .page-head h1 { margin: 4px 0 8px; font-size: clamp(1.7rem, 3vw, 2.4rem); line-height: 1.1; letter-spacing: -0.03em; }
    .page-head p { margin: 0; line-height: 1.55; max-width: 620px; }
    .head-actions { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .muted { color: var(--ms-text-muted); }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .metric { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
    .metric > span:first-child { color: var(--ms-text-muted); font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .metric strong { font-size: 1.6em; font-variant-numeric: tabular-nums; line-height: 1.15; }
    .metric a { font-size: 0.8em; font-weight: 700; color: var(--ms-primary-strong); text-decoration: none; margin-top: 2px; }
    .metric a:hover { text-decoration: underline; }
    .metric-note { font-size: 0.8em; color: var(--ms-text-muted); }
    .metric--urgent { border-left: 4px solid var(--ms-error); }
    .metric--urgent strong { color: var(--ms-error); }
    .columns { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
    .side { display: flex; flex-direction: column; gap: 16px; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 18px; box-shadow: var(--ms-shadow-sm); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.15rem; }
    .count { border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 5px 10px; font-size: 0.74rem; font-weight: 800; }
    .follow-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .follow-list li { display: flex; align-items: center; gap: 10px; padding: 11px 2px; border-top: 1px solid var(--ms-line); }
    .follow-list li:first-child { border-top: none; }
    .follow-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .follow-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pill { flex: none; border-radius: 999px; background: var(--ms-info-soft); color: var(--ms-info); font-size: 0.72em; font-weight: 800; padding: 4px 8px; white-space: nowrap; }
    .pill--late { background: var(--ms-error-soft); color: var(--ms-error); }
    .follow-list a { flex: none; min-height: 40px; }
    .empty { display: grid; place-items: center; gap: 8px; padding: 30px 16px; color: var(--ms-text-muted); text-align: center; }
    .empty mat-icon { font-size: 38px; width: 38px; height: 38px; }
    .empty p { margin: 0; line-height: 1.5; }
    .stage-list { display: flex; flex-direction: column; gap: 10px; }
    .stage-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 34px; align-items: center; gap: 8px; }
    .stage-label { font-size: 0.8em; color: var(--ms-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stage-track { height: 8px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; }
    .stage-track span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--ms-primary), var(--ms-secondary)); }
    .stage-row strong { font-size: 0.85em; text-align: right; font-variant-numeric: tabular-nums; }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .quick-grid a { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); color: var(--ms-text); text-decoration: none; font-size: 0.85em; font-weight: 600; min-height: 74px; }
    .quick-grid a:hover { background: var(--ms-primary-soft); }
    .quick-grid mat-icon { color: var(--ms-primary-strong); }
    .alert { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: var(--ms-radius-md); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { margin: 0; flex: 1; line-height: 1.5; }
    .empty-line { margin: 0; font-size: 0.9em; }
    @media (max-width: 900px) {
      .page-head { flex-direction: column; }
      .columns { grid-template-columns: 1fr; }
    }
  `],
})
export class PipelineHubComponent implements OnInit {
  private readonly leads = inject(LeadPipelineService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reminders = signal<RemindersData | null>(null);
  protected readonly prospects = signal<ProspectLead[]>([]);
  protected readonly prospectTotal = signal(0);

  protected readonly followUps = computed<ReminderEntry[]>(() => {
    const r = this.reminders();
    if (!r) return [];
    return [...r.overdue, ...r.today].slice(0, 8);
  });

  protected readonly stageRows = computed<StageRow[]>(() => {
    const list = this.prospects();
    if (list.length === 0) return [];
    const counts = new Map<ProspectStage, number>();
    for (const lead of list) {
      const stage = (lead.status?.stage ?? 'New') as ProspectStage;
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    return STAGE_ORDER
      .map((stage) => ({ stage, count: counts.get(stage) ?? 0 }))
      .filter((row) => row.count > 0)
      .map((row) => ({ ...row, percent: Math.round((row.count / list.length) * 100) }));
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    const partnerId = this.auth.currentUser()?.id ?? '';
    forkJoin({
      reminders: this.leads.reminders().pipe(catchError(() => of(null))),
      prospects: partnerId
        ? this.leads.listByPartner(partnerId, { limit: 200 }).pipe(catchError(() => of(null)))
        : of(null),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ reminders, prospects }) => {
        this.reminders.set(reminders?.data ?? null);
        this.prospects.set(prospects?.data ?? []);
        this.prospectTotal.set(prospects?.meta?.total ?? prospects?.data?.length ?? 0);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }
}
