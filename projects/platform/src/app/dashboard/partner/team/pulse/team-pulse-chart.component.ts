import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { formatMoney } from '../../../../core/format/money';
import { TeamHubFacade } from '../state/team-hub.facade';

/**
 * Compact team visual: active vs inactive membership and 30-day momentum.
 * The actionable priority queue stays below; this gives the quick picture.
 */
@Component({
  selector: 'async-team-pulse-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, RouterModule],
  template: `
    <section class="pulse-card" aria-labelledby="team-pulse-title">
      <header class="pulse-head">
        <div>
          <p class="eyebrow">Team snapshot</p>
          <h2 id="team-pulse-title">Health at a glance</h2>
          <p>Active members and 30-day momentum.</p>
        </div>
        <a routerLink="/dashboard/ora">Ask Ora who needs help</a>
      </header>

      @if (total() > 0) {
        <div class="pulse-body">
          <div class="donut-wrap">
            <div class="donut" [style.background]="donut()" role="img" [attr.aria-label]="donutLabel()">
              <div class="donut-hole">
                <strong>{{ active() | number }}</strong>
                <span>active</span>
                <small>of {{ total() | number }}</small>
              </div>
            </div>
          </div>

          <div class="momentum">
            <div class="momentum-row">
              <div class="momentum-head">
                <span>Recruits</span>
                <strong>{{ recruits().current | number }}</strong>
                <small [class.is-down]="recruits().deltaPct < 0">{{ deltaLabel(recruits().deltaPct) }}</small>
              </div>
              <div class="bar-pair" aria-hidden="true">
                <i class="bar bar--now" [style.width.%]="barWidth(recruits().current, recruits().previous)"></i>
                <i class="bar bar--before" [style.width.%]="barWidth(recruits().previous, recruits().current)"></i>
              </div>
              <div class="bar-legend"><span>Now</span><span>Previous 30 days</span></div>
            </div>

            <div class="momentum-row">
              <div class="momentum-head">
                <span>Team volume</span>
                <strong>{{ money(teamVolume().current) }}</strong>
                <small [class.is-down]="teamVolume().deltaPct < 0">{{ deltaLabel(teamVolume().deltaPct) }}</small>
              </div>
              <div class="bar-pair" aria-hidden="true">
                <i class="bar bar--now" [style.width.%]="barWidth(teamVolume().current, teamVolume().previous)"></i>
                <i class="bar bar--before" [style.width.%]="barWidth(teamVolume().previous, teamVolume().current)"></i>
              </div>
              <div class="bar-legend"><span>Now</span><span>Previous 30 days</span></div>
            </div>
          </div>
        </div>
      } @else {
        <div class="pulse-empty">
          <mat-icon>groups</mat-icon>
          <div>
            <strong>No team members yet</strong>
            <span>Share your referral link or open the activation board to start building.</span>
          </div>
          <a routerLink="/dashboard/mentorship/partners/my-partners">Open partners</a>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .pulse-card {
      padding: 20px 22px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background:
        radial-gradient(360px 180px at 100% 0%, color-mix(in srgb, var(--ms-primary-soft) 62%, transparent), transparent 70%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .pulse-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .pulse-head h2 { margin: 4px 0 4px; font-size: 1.08rem; letter-spacing: -0.02em; }
    .pulse-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.45; }
    .pulse-head a { flex: none; color: var(--ms-primary-strong); font-size: 0.74rem; font-weight: 700; text-decoration: none; align-self: center; }
    .pulse-head a:hover { text-decoration: underline; }

    .pulse-body {
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 24px;
      align-items: center;
    }

    .donut-wrap { display: grid; place-items: center; }
    .donut {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ms-line) 60%, transparent);
    }
    .donut-hole {
      width: 104px;
      height: 104px;
      border-radius: 50%;
      background: var(--ms-surface);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      text-align: center;
      box-shadow: 0 0 0 1px var(--ms-line);
    }
    .donut-hole strong { font-family: var(--ms-font-display); font-size: 1.55rem; line-height: 1; font-variant-numeric: tabular-nums; }
    .donut-hole span { color: var(--ms-text-muted); font-size: 0.64rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    .donut-hole small { color: var(--ms-text-muted); font-size: 0.66rem; }

    .momentum { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .momentum-row { display: flex; flex-direction: column; gap: 5px; }
    .momentum-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .momentum-head span { color: var(--ms-text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .momentum-head strong { font-size: 0.9rem; font-variant-numeric: tabular-nums; }
    .momentum-head small { color: var(--ms-success); font-size: 0.68rem; font-weight: 800; }
    .momentum-head small.is-down { color: var(--ms-error); }

    .bar-pair { display: flex; flex-direction: column; gap: 4px; }
    .bar { display: block; height: 7px; min-width: 2px; border-radius: 999px; }
    .bar--now { background: var(--ms-primary); }
    .bar--before { background: var(--ms-line); }
    .bar-legend { display: flex; justify-content: space-between; gap: 8px; color: var(--ms-text-muted); font-size: 0.62rem; }

    .pulse-empty { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); flex-wrap: wrap; }
    .pulse-empty > mat-icon { flex: none; width: 38px; height: 38px; padding: 8px; box-sizing: border-box; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .pulse-empty > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .pulse-empty strong { color: var(--ms-text); font-size: 0.84rem; }
    .pulse-empty span { font-size: 0.72rem; line-height: 1.45; }
    .pulse-empty a { flex: none; color: var(--ms-primary-strong); font-size: 0.74rem; font-weight: 700; text-decoration: none; }

    @media (max-width: 760px) {
      .pulse-card { padding: 16px; }
      .pulse-body { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      .donut { width: 136px; height: 136px; }
      .donut-hole { width: 94px; height: 94px; }
      .pulse-head a { width: 100%; }
      .pulse-empty a { width: 100%; }
    }
  `],
})
export class TeamPulseChartComponent {
  private readonly vm = inject(TeamHubFacade);

  protected readonly team = this.vm.team;
  protected readonly total = computed(() => Number(this.team()?.downline?.total ?? 0));
  protected readonly active = computed(() => Number(this.team()?.downline?.active ?? 0));
  protected readonly recruits = computed(() => this.team()?.recruits ?? { current: 0, previous: 0, deltaPct: 0 });
  protected readonly teamVolume = computed(() => this.team()?.teamVolume ?? { current: 0, previous: 0, deltaPct: 0 });

  protected readonly donut = computed(() => {
    const total = this.total();
    if (total <= 0) return 'conic-gradient(var(--ms-line) 0 100%)';
    const activePercent = Math.max(0, Math.min(100, (this.active() / total) * 100));
    return `conic-gradient(var(--ms-success) 0 ${activePercent.toFixed(2)}%, var(--ms-line) ${activePercent.toFixed(2)}% 100%)`;
  });

  protected donutLabel(): string {
    return `${this.active()} active out of ${this.total()} team members`;
  }

  protected barWidth(value: number, other: number): number {
    const max = Math.max(Number(value) || 0, Number(other) || 0, 1);
    return Math.max(2, ((Number(value) || 0) / max) * 100);
  }

  protected deltaLabel(value: number): string {
    const amount = Number(value) || 0;
    return `${amount >= 0 ? '+' : ''}${amount.toFixed(0)}%`;
  }

  protected money(value: number): string {
    return formatMoney(value, 0);
  }
}
