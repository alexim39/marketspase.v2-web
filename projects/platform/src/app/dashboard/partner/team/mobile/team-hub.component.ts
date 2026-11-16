import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageSkeletonComponent } from '@marketspase/shared/ui/page-skeleton/page-skeleton.component';
import { TeamHubFacade } from '../state/team-hub.facade';

@Component({
  selector: 'async-team-hub-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, PageSkeletonComponent, RouterModule],
  template: `
    <section class="team-page">
      <header class="page-head">
        <p class="eyebrow">Team · Duplicate your success</p>
        <h1>Who needs you today</h1>
        <p class="subtitle">Activation, training and coaching signals across your team.</p>
        <div class="head-actions">
          <a mat-flat-button color="primary" routerLink="/dashboard/team/handoffs">New member tasks</a>
          <a mat-stroked-button routerLink="/dashboard/mentorship/partners/my-partners">My partners</a>
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
            <span>Team</span>
            <strong>{{ (team()?.downline?.total ?? 0) | number }}</strong>
            <a routerLink="/dashboard/mentorship/partners/my-partners">View people</a>
          </div>
          <div class="metric">
            <span>Active</span>
            <strong>{{ (team()?.downline?.active ?? 0) | number }}</strong>
            <span class="metric-note">{{ team()?.downline?.inactive ?? 0 }} inactive</span>
          </div>
          <div class="metric">
            <span>Activation</span>
            <strong>@if (team()?.downline?.activationRate !== null) { {{ team()?.downline?.activationRate }}% } @else { — }</strong>
            <span class="metric-note">Last 30 days</span>
          </div>
        </div>

        <section class="panel">
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
                  <a class="board-row" routerLink="/dashboard/mentorship/team/activation">
                    <span class="avatar">{{ initials(item.member?.name) }}</span>
                    <span class="board-main">
                      <strong>{{ item.member?.name || item.member?.username || 'Team member' }}</strong>
                      <span class="muted">{{ item.relation || 'Partner' }} · {{ item.nextAction }}</span>
                    </span>
                    <span class="pill" [class.pill--bad]="item.nextTone === 'bad'" [class.pill--warn]="item.nextTone === 'warn'" [class.pill--ok]="item.nextTone === 'ok'">
                      {{ item.toneLabel }}
                    </span>
                    <mat-icon class="chevron">chevron_right</mat-icon>
                  </a>
                </li>
              }
            </ul>
          }
        </section>

        <section class="panel">
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
        </section>

        <section class="panel">
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
        </section>
      }
    </section>
  `,
  styles: [`
    .team-page { display: flex; flex-direction: column; gap: 14px; padding-bottom: 16px; }
    .page-head { display: flex; flex-direction: column; gap: 6px; }
    .page-head h1 { margin: 0; font-size: 1.9rem; line-height: 1.1; letter-spacing: -0.03em; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; }
    .subtitle { margin: 0; color: var(--ms-text-muted); line-height: 1.5; }
    .head-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }
    .head-actions a { min-height: 44px; }
    .head-actions a:first-child { grid-column: 1 / -1; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .metric { min-width: 0; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
    .metric > span:first-child { color: var(--ms-text-muted); font-size: 0.64em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .metric strong { font-size: 1.35em; font-variant-numeric: tabular-nums; line-height: 1.15; }
    .metric a, .metric-note { font-size: 0.68em; color: var(--ms-text-muted); }
    .metric a { color: var(--ms-primary-strong); font-weight: 700; text-decoration: none; }
    .muted { color: var(--ms-text-muted); }
    .panel { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 14px; min-width: 0; box-shadow: var(--ms-shadow-sm); }
    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
    .panel-head h2 { margin: 2px 0 0; font-size: 1.05rem; }
    .panel-head a { flex: none; min-height: 40px; }
    .score { border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); padding: 5px 12px; font-size: 0.9rem; font-weight: 800; }
    .board-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .board-list li { border-top: 1px solid var(--ms-line); }
    .board-list li:first-child { border-top: none; }
    .board-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; min-height: 52px; color: inherit; text-decoration: none; }
    .avatar { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 50%; display: grid; place-items: center; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-weight: 800; }
    .board-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .board-main strong, .board-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .board-main span { font-size: 0.78em; }
    .pill { flex: none; border-radius: 999px; background: var(--ms-info-soft); color: var(--ms-info); font-size: 0.66em; font-weight: 800; padding: 4px 8px; white-space: nowrap; }
    .pill--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .pill--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .pill--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .chevron { flex: none; color: var(--ms-text-muted); }
    .empty { display: grid; place-items: center; gap: 8px; padding: 24px 8px; color: var(--ms-text-muted); text-align: center; }
    .empty p { margin: 0; line-height: 1.5; }
    .empty a { width: 100%; min-height: 44px; }
    .recommendations { margin: 0 0 12px; padding-left: 1.15em; display: grid; gap: 8px; line-height: 1.4; font-size: 0.86em; color: var(--ms-text-muted); }
    .health-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .health-stats span { display: flex; flex-direction: column; gap: 1px; padding: 8px 10px; border-radius: var(--ms-radius-sm); background: var(--ms-canvas); }
    .health-stats small { color: var(--ms-text-muted); font-size: 0.66em; text-transform: uppercase; letter-spacing: 0.06em; }
    .quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .quick-grid a { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-md); color: var(--ms-text); text-decoration: none; font-size: 0.82em; font-weight: 600; min-height: 72px; }
    .quick-grid a:active { background: var(--ms-primary-soft); }
    .quick-grid mat-icon { color: var(--ms-primary-strong); }
    .alert { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: var(--ms-radius-md); background: var(--ms-error-soft); color: var(--ms-error); }
    .alert p { margin: 0; flex: 1; line-height: 1.5; }
  `],
})
export class TeamHubMobileComponent {
  private readonly facade = inject(TeamHubFacade);

  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly team = this.facade.team;
  protected readonly priorityItems = this.facade.priorityItems;

  constructor() { this.facade.ensureLoaded(); }
  protected reload(): void { this.facade.reload(); }
  protected initials(name: string | undefined): string { return this.facade.initials(name); }
}
