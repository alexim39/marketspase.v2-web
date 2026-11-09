import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { OraService } from '../../core/ora/ora.service';
import { OraAction, OraAnalytics, OraPlan, actionPlanItems } from '../../core/ora/ora.models';
import { ApiError } from '../../core/http/api-error';
import { OraChatComponent } from './ora-chat.component';

const RECOMMENDATIONS: Array<{ title: string; body: string; link: string; linkLabel: string }> = [
  {
    title: 'Review today\u2019s follow-ups',
    body: 'Overdue prospects close fastest — work the pipeline before noon.',
    link: '/dashboard/prospects/pipeline',
    linkLabel: 'Open Pipeline',
  },
  {
    title: 'Check goal pace',
    body: 'At-risk goals need daily attention while there are still days left.',
    link: '/dashboard/goals',
    linkLabel: 'View Goals',
  },
  {
    title: 'See this week\u2019s events',
    body: 'Show up, bring a prospect, and RSVP so leaders can plan.',
    link: '/dashboard/community/events',
    linkLabel: 'View Events',
  },
  {
    title: 'Read team updates',
    body: 'Leaders who read the team outperform those who guess.',
    link: '/dashboard/team',
    linkLabel: 'Team',
  },
];

/**
 * @title Ora page — full-screen mentor experience.
 *
 * Chat surface (shared `OraChatComponent`) beside recommendations and
 * the member's personal Ora analytics. OnPush + signals, fully typed.
 */
@Component({
  selector: 'async-ora-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, RouterModule, OraChatComponent],
  template: `
    <section class="breadcrumb-wrapper">
      <div class="breadcrumb">
        <a routerLink="/dashboard">Dashboard</a> &gt;
        <span>Ora</span>
      </div>
    </section>

    <section class="ora-page">
      <div class="page-head">
        <div>
          <h2>Ora — your AI business partner</h2>
          <p class="subtitle">You approve the next move. Ora prepares the work from your pipeline, campaigns, team and goals.</p>
        </div>
      </div>

      <div class="ora-layout">
        <div class="ora-chat-card">
          <async-ora-chat />
        </div>

        <aside class="ora-side">
          <article class="card">
            <h3>Today's plan</h3>
            @if (loadingPlan()) {
              <mat-progress-bar mode="indeterminate" aria-label="Loading plan" />
            } @else if (plan(); as today) {
              @if (today.items.length) {
                <ul class="plan">
                  @for (item of today.items; track item.title) {
                    <li>
                      <strong>{{ item.title }}</strong>
                      @if (item.detail) { <span class="muted">{{ item.detail }}</span> }
                      @if (item.link) { <a mat-button [routerLink]="item.link">Open</a> }
                    </li>
                  }
                </ul>
                <p class="muted">Ask Ora to change it; you approve the update.</p>
              } @else {
                <p class="muted">Ask Ora to plan your day.</p>
              }
            } @else {
              <p class="muted">Ask Ora to plan your day.</p>
            }
          </article>

          <article class="card">
            <h3>Recommended for you</h3>
            @for (r of recommendations; track r.title) {
              <div class="rec">
                <div>
                  <strong>{{ r.title }}</strong>
                  <p class="muted">{{ r.body }}</p>
                </div>
                <a mat-button [routerLink]="r.link">{{ r.linkLabel }}</a>
              </div>
            }
          </article>

          <article class="card">
            <h3>Waiting for your approval</h3>
            @if (pending().length === 0) {
              <p class="muted">Nothing waiting. Ask Ora for today’s plan.</p>
            } @else {
              @for (a of pending(); track a.id) {
                <div class="approval">
                  <div>
                    <strong>{{ a.label }}</strong>
                    @if (a.payload?.subject) {
                      <p class="draft-subject">{{ a.payload?.subject }}</p>
                    }
                    @if (a.payload?.body) {
                      <p class="draft">{{ a.payload?.body }}</p>
                    }
                    @if (a.type === 'save_daily_plan' && planItems(a).length) {
                      <ul class="plan">
                        @for (item of planItems(a); track item.title) {
                          <li>
                            <strong>{{ item.title }}</strong>
                            @if (item.detail) { <span class="muted">{{ item.detail }}</span> }
                          </li>
                        }
                      </ul>
                    }
                    <p class="muted">{{ a.summary }}</p>
                  </div>
                  <div class="approval-actions">
                    <button mat-flat-button color="primary" type="button" (click)="approve(a)" [disabled]="actingId() === a.id">
                      {{ actingId() === a.id ? 'Working…' : 'Approve' }}
                    </button>
                    <button mat-stroked-button type="button" (click)="skip(a)" [disabled]="actingId() === a.id">Skip</button>
                    @if (a.link) {
                      <a mat-button [routerLink]="a.link">Open</a>
                    }
                  </div>
                </div>
              }
            }
          </article>

          <article class="card">
            <h3>Your Ora journey</h3>
            @if (loadingStats()) {
              <mat-progress-bar mode="indeterminate" aria-label="Loading" />
            } @else if (stats(); as s) {
              <p class="big">{{ s.questions }} <span class="muted">questions · {{ s.activeDays }} active days</span></p>
              @if (s.perTopic.length > 0) {
                <ul class="topics">
                  @for (t of s.perTopic; track t.topic) {
                    <li>
                      <span>{{ t.label }}</span>
                      <span class="bar"><span class="fill" [style.width.%]="topicWidth(t.count, s.questions)"></span></span>
                      <span class="muted">{{ t.count }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="muted">Ask your first question and your topics will appear here.</p>
              }
            } @else {
              <p class="muted">Stats unavailable right now.</p>
            }
          </article>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    .breadcrumb-wrapper { margin-bottom: 1em; }
    .breadcrumb a { text-decoration: none; }
    .ora-page { display: flex; flex-direction: column; gap: 1em; padding-bottom: 2em; }
    .page-head h2 { margin: 0; }
    .subtitle { margin: 0.25em 0 0; color: var(--ms-text-muted); }
    .ora-layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 1em; align-items: start; }
    .ora-chat-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; height: min(640px, calc(100dvh - 14em)); min-height: 420px; overflow: hidden; }
    .ora-side { display: flex; flex-direction: column; gap: 1em; }
    .card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: 14px; padding: 1em; display: flex; flex-direction: column; gap: 0.75em; }
    .card h3 { margin: 0; }
    .rec { display: flex; justify-content: space-between; align-items: center; gap: 0.6em; border-top: 1px solid var(--ms-line); padding-top: 0.6em; }
    .rec p { margin: 0.15em 0 0; }
    .rec a { flex: none; min-height: 44px; }
    .approval { display: flex; flex-direction: column; gap: 0.5em; border-top: 1px solid var(--ms-line); padding-top: 0.65em; }
    .approval:first-of-type { border-top: none; padding-top: 0; }
    .approval p { margin: 0.15em 0 0; }
    .approval .draft-subject { color: inherit; font-weight: 700; }
    .approval .draft { white-space: pre-wrap; max-height: 8em; overflow-y: auto; padding: 0.4em 0.55em; border-left: 2px solid var(--ms-primary); background: var(--ms-canvas); border-radius: 4px; }
    .plan { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5em; }
    .plan li { display: flex; flex-direction: column; gap: 0.15em; border-top: 1px solid var(--ms-line); padding-top: 0.5em; }
    .plan li:first-child { border-top: none; padding-top: 0; }
    .plan a { align-self: flex-start; min-height: 44px; }
    .approval-actions { display: flex; gap: 0.35em; flex-wrap: wrap; }
    .approval-actions button, .approval-actions a { min-height: 44px; }
    .big { margin: 0; font-size: 1.5em; font-weight: 800; }
    .topics { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4em; }
    .topics li { display: flex; align-items: center; gap: 0.6em; font-size: 0.9em; }
    .bar { flex: 1; height: 8px; border-radius: 999px; background: var(--ms-line); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--ms-primary); }
    .muted { color: var(--ms-text-muted); font-size: 0.85em; }
    @media (max-width: 900px) {
      .ora-layout { grid-template-columns: 1fr; }
    }
  `],
})
export class OraPageComponent implements OnInit {
  private readonly ora = inject(OraService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stats = signal<OraAnalytics | null>(null);
  protected readonly loadingStats = signal(true);
  protected readonly pending = signal<OraAction[]>([]);
  protected readonly actingId = signal<string | null>(null);
  protected readonly plan = signal<OraPlan | null>(null);
  protected readonly loadingPlan = signal(true);
  protected readonly planItems = actionPlanItems;
  protected readonly recommendations = RECOMMENDATIONS;

  ngOnInit(): void {
    this.loadPlan();
    this.ora
      .analytics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.stats.set(res.data ?? null);
          this.loadingStats.set(false);
        },
        error: (err: ApiError) => {
          void err;
          this.loadingStats.set(false);
        },
      });
    this.loadPending();
  }

  private loadPending(): void {
    this.ora
      .pendingActions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.pending.set(res.data ?? []),
        error: () => this.pending.set([]),
      });
  }

  private loadPlan(): void {
    this.ora
      .plan()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.plan.set(res.data ?? null);
          this.loadingPlan.set(false);
        },
        error: () => this.loadingPlan.set(false),
      });
  }

  protected approve(action: OraAction): void {
    if (!action.id || this.actingId()) return;
    this.actingId.set(action.id);
    this.ora
      .approveAction(action.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pending.update((rows) => rows.filter((row) => row.id !== action.id));
          if (action.type === 'save_daily_plan') this.loadPlan();
          this.actingId.set(null);
        },
        error: () => this.actingId.set(null),
      });
  }

  protected skip(action: OraAction): void {
    if (!action.id || this.actingId()) return;
    this.actingId.set(action.id);
    this.ora
      .skipAction(action.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pending.update((rows) => rows.filter((row) => row.id !== action.id));
          this.actingId.set(null);
        },
        error: () => this.actingId.set(null),
      });
  }

  protected topicWidth(count: number, total: number): number {
    return total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0;
  }
}
