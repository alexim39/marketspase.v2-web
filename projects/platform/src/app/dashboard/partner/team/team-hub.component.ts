import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { AnalyticsService } from '../../../core/analytics/analytics.service';
import { DashboardOverview } from '../../../core/analytics/analytics.models';
import { LeadPipelineService } from '../prospects/lead-pipeline/lead-pipeline.service';
import { ActivationBoard, ActivationBoardItem } from '../prospects/lead-pipeline/lead.models';
import { ApiError, userError } from '../../../core/http/api-error';

/**
 * Team hub — the daily coaching queue. Surfaces who needs attention first,
 * team health and shortcuts into the existing mentorship/network pages.
 */
@Component({
  selector: 'async-team-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    PageSkeletonComponent,
    RouterModule,
  ],
  template: `
    <section class="team-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Team · Duplicate your success</p>
          <h1>Who needs you today</h1>
          <p class="muted">Activation, training and coaching signals across your team.</p>
        </div>
        <div class="head-actions">
          <a mat-flat-button color="primary" routerLink="/dashboard/mentorship/partners/my-partners">My partners</a>
          <a mat-stroked-button routerLink="/dashboard/network/tree">Team tree</a>
        </div>
      </header>

      @if (loading()) {
        <async-page-skeleton layout="dashboard" [rows]="3" label="your team" [showHeader]="false" />
      }

      @if (error(); as err) {
        <div class="alert" role="alert">
          <mat-icon>error_outline</mat-icon>
          <p>{{ err }}</p>
          <button mat-button type="button" (click)="reload()">Retry</button>
        </div>
      }

      @if (!loading()) {
      <div class="metrics">
        <div class="metric">
          <span>Team members</span>
          <strong>{{ (team()?.downline?.total ?? 0) | number }}</strong>
          <a routerLink="/dashboard/mentorship/partners/my-partners">View people</a>
        </div>
        <div class="metric">
          <span>Active</span>
          <strong>{{ (team()?.downline?.active ?? 0) | number }}</strong>
          <span class="metric-note">{{ team()?.downline?.inactive ?? 0 }} inactive</span>
        </div>
        <div class="metric">
          <span>Activation rate</span>
          <strong>@if (team()?.downline?.activationRate !== null) { {{ team()?.downline?.activationRate }}% } @else { — }</strong>
          <span class="metric-note">Last 30 days</span>
        </div>
      </div>

      <div class="columns">
        <div class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Priority queue</p>
              <h2>Activation board</h2>
            </div>
            <a mat-button routerLink="/dashboard/mentorship/team/activation">Full board</a>
          </div>

          @if (priorityItems().length === 0) {
            <div class="empty">
              <mat-icon>groups</mat-icon>
              <p>No team members need attention right now. Share the opportunity or check back after your next follow-up.</p>
              <a mat-flat-button color="primary" routerLink="/dashboard/mentorship/partners/my-partners">Open partners</a>
            </div>
          } @else {
            <ul class="board-list">
              @for (item of priorityItems(); track item.partnerId) {
                <li>
                  <div class="avatar">{{ initials(item.member?.name) }}</div>
                  <div class="board-main">
                    <strong>{{ item.member?.name || item.member?.username || 'Team member' }}</strong>
                    <span class="muted">{{ item.relation || 'Partner' }} · {{ item.nextAction }}</span>
                  </div>
                  <span class="pill" [class.pill--bad]="item.nextTone === 'bad'" [class.pill--warn]="item.nextTone === 'warn'" [class.pill--ok]="item.nextTone === 'ok'">
                    {{ item.toneLabel }}
                  </span>
                  <a mat-button routerLink="/dashboard/mentorship/team/activation">Open</a>
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
                <h2>Team pulse</h2>
              </div>
              <span class="score">{{ team()?.health?.score ?? '—' }}</span>
            </div>
            @if (team()?.health?.recommendations?.length) {
              <ul class="recommendations">
                @for (tip of team()?.health?.recommendations; track tip) {
                  <li>{{ tip }}</li>
                }
              </ul>
            } @else {
              <p class="muted">No health recommendations yet. Keep working your follow-ups and activation board.</p>
            }
            <div class="health-stats">
              <span><small>Recruits</small><strong>{{ team()?.recruits?.current ?? 0 }}</strong></span>
              <span><small>Conversions</small><strong>{{ team()?.conversions ?? 0 }}</strong></span>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Shortcuts</p>
                <h2>Coach your team</h2>
              </div>
            </div>
            <div class="quick-grid">
              <a routerLink="/dashboard/mentorship/team/activation"><mat-icon>assignment_ind</mat-icon><span>Activation board</span></a>
              <a routerLink="/dashboard/mentorship/partners/my-partners"><mat-icon>groups</mat-icon><span>My partners</span></a>
              <a routerLink="/dashboard/network/tree"><mat-icon>account_tree</mat-icon><span>Team tree</span></a>
              <a routerLink="/dashboard/network/org"><mat-icon>layers</mat-icon><span>Levels view</span></a>
              <a routerLink="/dashboard/mentorship/team/members"><mat-icon>diversity_3</mat-icon><span>My teams</span></a>
              <a routerLink="/dashboard/mentorship/team/new"><mat-icon>group_add</mat-icon><span>Start a team</span></a>
            </div>
          </div>
        </aside>
      </div>
      }
    </section>
  `,
  styles: [`
    .team-page { max-width: 1180px; margin: 0 auto; padding: 24px 0 48px; display: flex; flex-direction: column; gap: 16px; }
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
    .metric--attention { border-left: 4px solid var(--ms-warning); }
    .columns { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); gap: 16px; align-items: start; }
    .side { display: flex; flex-direction: column; gap: 16px; }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 18px; box-shadow: var(--ms-shadow-sm); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .panel-head h2 { margin: 4px 0 0; font-size: 1.15rem; }
    .score { border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 5px 12px; font-size: 0.9rem; font-weight: 800; }
    .board-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .board-list li { display: flex; align-items: center; gap: 10px; padding: 11px 2px; border-top: 1px solid var(--ms-line); }
    .board-list li:first-child { border-top: none; }
    .avatar { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .board-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .board-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .board-main span { font-size: 0.82em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pill { flex: none; border-radius: 999px; background: var(--ms-info-soft); color: var(--ms-info); font-size: 0.72em; font-weight: 800; padding: 4px 8px; white-space: nowrap; }
    .pill--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .pill--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .pill--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .board-list a { flex: none; min-height: 40px; }
    .empty { display: grid; place-items: center; gap: 8px; padding: 30px 16px; color: var(--ms-text-muted); text-align: center; }
    .empty mat-icon { font-size: 38px; width: 38px; height: 38px; }
    .empty p { margin: 0; line-height: 1.5; }
    .recommendations { margin: 0 0 12px; padding-left: 1.15em; display: grid; gap: 8px; line-height: 1.4; font-size: 0.9em; color: var(--ms-text-muted); }
    .health-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .health-stats span { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); }
    .health-stats small { color: var(--ms-text-muted); font-size: 0.7em; text-transform: uppercase; letter-spacing: 0.06em; }
    .health-stats strong { font-variant-numeric: tabular-nums; }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .quick-grid a { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); color: var(--ms-text); text-decoration: none; font-size: 0.85em; font-weight: 600; min-height: 74px; }
    .quick-grid a:hover { background: var(--ms-primary-soft); }
    .quick-grid mat-icon { color: var(--ms-primary-strong); }
    .alert { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: var(--ms-radius-md); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { margin: 0; flex: 1; line-height: 1.5; }
    @media (max-width: 900px) {
      .page-head { flex-direction: column; }
      .columns { grid-template-columns: 1fr; }
    }
  `],
})
export class TeamHubComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly leads = inject(LeadPipelineService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<DashboardOverview | null>(null);
  protected readonly activation = signal<ActivationBoard | null>(null);

  protected readonly team = computed(() => this.overview()?.team ?? null);

  protected readonly priorityItems = computed<Array<ActivationBoardItem & { toneLabel: string }>>(() => {
    const items = this.activation()?.items ?? [];
    const rank = (tone: ActivationBoardItem['nextTone']) => tone === 'bad' ? 0 : tone === 'warn' ? 1 : tone === 'info' ? 2 : 3;
    return [...items]
      .sort((a, b) => rank(a.nextTone) - rank(b.nextTone))
      .slice(0, 6)
      .map((item) => ({ ...item, toneLabel: item.nextTone === 'bad' ? 'Action' : item.nextTone === 'warn' ? 'Training' : 'On track' }));
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      overview: this.analytics.overview(30).pipe(catchError(() => of(null))),
      activation: this.leads.activationBoard().pipe(catchError(() => of(null))),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ overview, activation }) => {
        this.overview.set(overview?.data ?? null);
        this.activation.set(activation?.data ?? null);
      },
      error: (err: ApiError) => this.error.set(userError(err)),
    });
  }

  protected initials(name: string | undefined): string {
    return String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]?.toUpperCase()).join('') || 'T';
  }
}
