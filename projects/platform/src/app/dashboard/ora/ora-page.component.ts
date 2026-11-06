import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterModule } from '@angular/router';
import { OraService } from '../../core/ora/ora.service';
import { OraAnalytics } from '../../core/ora/ora.models';
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
    link: '/dashboard/insights/team-reports',
    linkLabel: 'Team Reports',
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
          <h2>Ora — your growth coach</h2>
          <p class="subtitle">Business growth, leadership and community guidance.</p>
        </div>
      </div>

      <div class="ora-layout">
        <div class="ora-chat-card">
          <async-ora-chat />
        </div>

        <aside class="ora-side">
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
  protected readonly recommendations = RECOMMENDATIONS;

  ngOnInit(): void {
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
  }

  protected topicWidth(count: number, total: number): number {
    return total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0;
  }
}
