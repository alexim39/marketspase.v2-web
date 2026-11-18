import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import type { Funnel, FunnelStep } from '../../../../../core/analytics/analytics.models';

const COLORS = ['#667eea', '#7c83f2', '#8e95f5', '#a0adf3', '#b4baf7', '#9ca3af'];

/**
 * Lightweight stage funnel for the lead pipeline. The stage cards below remain
 * the actionable filter; this answers "where are prospects dropping off?"
 */
@Component({
  selector: 'async-pipeline-funnel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterModule],
  template: `
    @if (steps().length > 0) {
      <section class="funnel-card" aria-labelledby="pipeline-funnel-title">
        <header class="funnel-head">
          <div>
            <p class="eyebrow">Conversion funnel</p>
            <h2 id="pipeline-funnel-title">Where prospects move</h2>
            <p>Last 30 days of pipeline activity.</p>
          </div>
          @if (funnel()?.overallRate !== null && funnel()?.overallRate !== undefined) {
            <span class="rate-chip">{{ funnel()?.overallRate }}% converted</span>
          }
        </header>

        @if (hasData()) {
          <div class="funnel" role="list" aria-label="Pipeline stages and conversion">
            @for (step of steps(); track step.stage; let i = $index) {
              <div class="step" role="listitem">
                <div class="step-head">
                  <span class="stage">{{ step.stage }}</span>
                  <strong>{{ step.count }}</strong>
                </div>
                <div class="track" aria-hidden="true">
                  <span [style.width.%]="width(step)" [style.background]="color(i)"></span>
                </div>
                <div class="step-meta">
                  @if (i === 0) {
                    <span>Starting stage</span>
                  } @else if (step.stepRate !== null) {
                    <span>{{ step.stepRate }}% from previous</span>
                  }
                  @if (step.dropoff > 0) {
                    <span class="drop">{{ step.dropoff }} dropped</span>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="funnel-empty">
            <mat-icon>filter_alt</mat-icon>
            <div>
              <strong>No prospect activity in the last 30 days</strong>
              <span>Add a prospect or move a conversation forward to start the funnel.</span>
            </div>
            <a mat-button routerLink="/dashboard/prospects/new">Add prospect</a>
          </div>
        }

        <footer class="funnel-foot">
          <span>Stages follow your live prospect records.</span>
          <a routerLink="/dashboard/ora">Ask Ora who to follow up with</a>
        </footer>
      </section>
    }
  `,
  styles: [`
    :host { display: block; }

    .funnel-card {
      padding: 20px 22px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background:
        radial-gradient(360px 180px at 100% 0%, color-mix(in srgb, var(--ms-primary-soft) 62%, transparent), transparent 70%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .funnel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .funnel-head h2 { margin: 4px 0 4px; font-size: 1.08rem; letter-spacing: -0.02em; }
    .funnel-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.45; }
    .rate-chip { flex: none; padding: 5px 10px; border-radius: 999px; background: var(--ms-success-soft); color: var(--ms-success); font-size: 0.7rem; font-weight: 800; font-variant-numeric: tabular-nums; }

    .funnel { display: flex; flex-direction: column; gap: 10px; }
    .step { display: flex; flex-direction: column; gap: 4px; }
    .step-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .stage { color: var(--ms-text); font-size: 0.8rem; font-weight: 650; }
    .step-head strong { font-size: 0.82rem; font-variant-numeric: tabular-nums; }
    .track { height: 10px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; }
    .track span { display: block; height: 100%; min-width: 3px; border-radius: inherit; transition: width 240ms ease; }
    .step-meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--ms-text-muted); font-size: 0.66rem; }
    .drop { color: var(--ms-warning); }
    .funnel-empty { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px dashed var(--ms-line); border-radius: var(--ms-radius-lg); color: var(--ms-text-muted); flex-wrap: wrap; }
    .funnel-empty > mat-icon { flex: none; width: 38px; height: 38px; padding: 8px; box-sizing: border-box; border-radius: 10px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .funnel-empty > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .funnel-empty strong { color: var(--ms-text); font-size: 0.84rem; }
    .funnel-empty span { font-size: 0.72rem; line-height: 1.45; }
    .funnel-empty a { flex: none; }
    .funnel-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; padding-top: 11px; border-top: 1px solid var(--ms-line); color: var(--ms-text-muted); font-size: 0.68rem; }
    .funnel-foot a { color: var(--ms-primary-strong); font-weight: 700; text-decoration: none; }
    .funnel-foot a:hover { text-decoration: underline; }

    @media (max-width: 640px) {
      .funnel-card { padding: 16px; }
      .funnel-empty a { width: 100%; justify-content: center; }
      .funnel-foot a { width: 100%; }
    }
  `],
})
export class PipelineFunnelComponent {
  readonly funnel = input<Funnel | null>(null);

  protected readonly steps = computed(() => this.funnel()?.steps ?? []);

  protected readonly hasData = computed(() => {
    const data = this.funnel();
    return Boolean(data && (
      Number(data.entered) > 0
      || data.steps.some((step) => Number(step.count) > 0)
    ));
  });

  private readonly maxCount = computed(() => Math.max(1, this.steps()[0]?.count ?? 1));

  protected width(step: FunnelStep): number {
    return Math.max(3, (Number(step.count) || 0) / this.maxCount() * 100);
  }

  protected color(index: number): string {
    return COLORS[index % COLORS.length];
  }
}
