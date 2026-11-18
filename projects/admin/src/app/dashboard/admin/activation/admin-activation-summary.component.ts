import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { AdminActivationSummary } from '../../../core/onboarding/onboarding.models';

/**
 * Activation funnel and queue aging. Read-only summary above the order/KYC
 * tabs; the actionable rows remain below.
 */
@Component({
  selector: 'async-admin-activation-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatIconModule, MatProgressBarModule],
  template: `
    <section class="activation-summary" aria-labelledby="activation-summary-title">
      <header class="summary-head">
        <div>
          <p class="eyebrow">Activation snapshot</p>
          <h2 id="activation-summary-title">Onboarding funnel</h2>
          <p>Where members are in the journey, and what is waiting too long.</p>
        </div>
        @if (summary(); as data) {
          <span class="accounts">{{ data.accounts.total | number }} accounts</span>
        }
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Loading activation summary" />
      } @else if (summary(); as data) {
        <div class="summary-grid">
          <div class="funnel">
            @for (step of funnel(); track step.stage; let i = $index) {
              <div class="funnel-step">
                <div class="step-head"><span>{{ step.stage }}</span><strong>{{ step.count | number }}</strong></div>
                <div class="track"><i [style.width.%]="width(step.count)" [style.opacity]="1 - i * 0.08"></i></div>
              </div>
            }
          </div>

          <div class="side">
            <div class="side-block">
              <h3>Identity checks</h3>
              <div class="chips">
                <span class="chip chip--warn">Pending {{ data.kyc.pending }}</span>
                <span class="chip chip--ok">Verified {{ data.kyc.verified }}</span>
                <span class="chip chip--bad">Rejected {{ data.kyc.rejected }}</span>
              </div>
            </div>
            <div class="side-block">
              <h3>Queue aging</h3>
              <div class="aging-grid">
                <span><small>Over 3 days</small><strong>{{ data.aging.queueOver3Days }}</strong></span>
                <span><small>Over 7 days</small><strong>{{ data.aging.queueOver7Days }}</strong></span>
                <span><small>Over 14 days</small><strong>{{ data.aging.queueOver14Days }}</strong></span>
              </div>
            </div>
            <div class="side-block">
              <h3>Orders waiting</h3>
              <div class="aging-grid">
                <span><small>Paid</small><strong>{{ data.orders.paid }}</strong></span>
                <span><small>Over 3 days</small><strong>{{ data.aging.paidOver3Days }}</strong></span>
                <span><small>Over 7 days</small><strong>{{ data.aging.paidOver7Days }}</strong></span>
              </div>
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }

    .activation-summary {
      padding: 20px 22px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background:
        radial-gradient(360px 180px at 100% 0%, color-mix(in srgb, var(--ms-primary-soft) 62%, transparent), transparent 70%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .summary-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .summary-head h2 { margin: 4px 0 4px; font-size: 1.08rem; letter-spacing: -0.02em; }
    .summary-head p { margin: 0; color: var(--ms-text-muted); font-size: 0.78rem; line-height: 1.45; }
    .accounts { flex: none; padding: 5px 10px; border-radius: 999px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); font-size: 0.7rem; font-weight: 800; }

    .summary-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr);
      gap: 18px;
      align-items: start;
    }
    .funnel { display: flex; flex-direction: column; gap: 10px; }
    .funnel-step { display: flex; flex-direction: column; gap: 4px; }
    .step-head { display: flex; justify-content: space-between; gap: 10px; font-size: 0.78rem; }
    .step-head span { color: var(--ms-text); font-weight: 650; }
    .step-head strong { font-variant-numeric: tabular-nums; }
    .track { height: 10px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; }
    .track i { display: block; height: 100%; min-width: 2px; border-radius: inherit; background: var(--ms-primary); }

    .side { display: flex; flex-direction: column; gap: 10px; }
    .side-block { padding: 12px; border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); background: var(--ms-canvas); }
    .side-block h3 { margin: 0 0 8px; font-size: 0.8rem; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { padding: 4px 8px; border-radius: 999px; font-size: 0.66rem; font-weight: 800; }
    .chip--warn { background: var(--ms-warning-soft); color: var(--ms-warning); }
    .chip--ok { background: var(--ms-success-soft); color: var(--ms-success); }
    .chip--bad { background: var(--ms-error-soft); color: var(--ms-error); }
    .aging-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .aging-grid span { display: flex; flex-direction: column; gap: 1px; padding: 7px 8px; border-radius: var(--ms-radius-sm); background: var(--ms-surface); }
    .aging-grid small { color: var(--ms-text-muted); font-size: 0.6rem; line-height: 1.2; }
    .aging-grid strong { font-size: 0.86rem; font-variant-numeric: tabular-nums; }

    @media (max-width: 900px) {
      .summary-grid { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 600px) {
      .activation-summary { padding: 16px; }
      .aging-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
})
export class AdminActivationSummaryComponent {
  readonly summary = input<AdminActivationSummary | null>(null);
  readonly loading = input(false);

  protected readonly funnel = computed(() => this.summary()?.funnel ?? []);

  protected width(count: number): number {
    const rows = this.funnel();
    const max = Math.max(1, rows[0]?.count ?? 1);
    return Math.max(2, (Number(count) || 0) / max * 100);
  }
}
