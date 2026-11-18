import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CompensationFacade } from '../state/compensation.facade';

type EarningSource = {
  key: string;
  label: string;
  color: string;
  released: number;
  pending: number;
  percent: number;
};

type DonutSegment = EarningSource & {
  dash: string;
  offset: string;
};

/**
 * Visual answer to "where does my money come from?" — released earnings by
 * source, with pending amounts and a direct route into Ora for a next step.
 */
@Component({
  selector: 'async-compensation-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, RouterModule],
  template: `
    <section class="map-card" aria-labelledby="earnings-map-title">
      <header class="map-head">
        <div class="head-copy">
          <p class="eyebrow">Earnings map</p>
          <h2 id="earnings-map-title">See where your money comes from</h2>
          <p>Released earnings by source. Pending amounts are shown under each stream.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard/ora" class="ask-link">
          <mat-icon>auto_awesome</mat-icon>
          Ask Ora
        </a>
      </header>

      @if (releasedTotal() > 0 || pendingTotal() > 0) {
        <div class="map-body">
          <div class="chart-side">
            <div class="donut-wrap" role="img" [attr.aria-label]="chartLabel()">
              <svg viewBox="0 0 180 180" aria-hidden="true">
                <circle class="donut-track" cx="90" cy="90" r="64" pathLength="100" />
                @for (segment of segments(); track segment.key) {
                  <circle
                    class="donut-segment"
                    cx="90"
                    cy="90"
                    r="64"
                    pathLength="100"
                    [attr.stroke]="segment.color"
                    [attr.stroke-dasharray]="segment.dash"
                    [attr.stroke-dashoffset]="segment.offset"
                    transform="rotate(-90 90 90)" />
                }
              </svg>
              <div class="donut-center">
                <span>Released</span>
                <strong>{{ vm.money(releasedTotal()) }}</strong>
                <small>{{ segments().length ? (segments().length === 1 ? '1 active stream' : segments().length + ' active streams') : 'Nothing released yet' }}</small>
              </div>
            </div>

            @if (topStream(); as top) {
              <p class="top-note">
                <span class="dot" [style.background]="top.color" aria-hidden="true"></span>
                Largest source: <strong>{{ top.label }}</strong> at {{ top.percent | number: '1.0-0' }}%
              </p>
            } @else if (pendingTotal() > 0) {
              <p class="top-note">Nothing released yet. Your pending amounts are shown below.</p>
            }
          </div>

          <div class="legend" aria-label="Earnings by source">
            @for (item of mix(); track item.key) {
              <div class="legend-row">
                <span class="dot" [style.background]="item.color" aria-hidden="true"></span>
                <div class="legend-copy">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.pending > 0 ? ('Pending ' + vm.money(item.pending)) : (item.released > 0 ? 'Fully released' : 'No activity yet') }}</small>
                </div>
                <div class="legend-value">
                  <strong>{{ vm.money(item.released) }}</strong>
                  <small>{{ item.percent | number: '1.0-0' }}%</small>
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="map-empty">
          <span class="empty-icon"><mat-icon>insights</mat-icon></span>
          <div>
            <h3>Your earnings map starts with the first commission</h3>
            <p>Product activity in your team creates entries here. Ask Ora for one next step, or open your store to start selling.</p>
          </div>
          <a mat-flat-button color="primary" routerLink="/dashboard/products/my-store">Open my store</a>
        </div>
      }

      <footer class="map-foot">
        <span><strong>Released</strong> is already in your wallet.</span>
        <span><strong>Pending</strong> is accrued and waiting for release.</span>
        <span>Commissions use product gross margin, not the full sale price.</span>
      </footer>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .map-card {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 22px 24px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-2xl);
      background:
        radial-gradient(420px 220px at 0% 0%, color-mix(in srgb, var(--ms-primary-soft) 72%, transparent), transparent 72%),
        var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
    }

    .map-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .head-copy { min-width: 0; }
    .eyebrow { margin: 0; color: var(--ms-primary-strong); font-size: 0.6875rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .map-head h2 { margin: 4px 0 6px; font-size: 1.18rem; letter-spacing: -0.02em; }
    .map-head p { margin: 0; max-width: 62ch; color: var(--ms-text-muted); font-size: 0.84rem; line-height: 1.55; }
    .ask-link { flex: none; }
    .ask-link mat-icon { margin-right: 5px; }

    .map-body {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 24px;
      align-items: center;
    }

    .chart-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .donut-wrap {
      position: relative;
      width: 180px;
      height: 180px;
    }
    .donut-wrap svg { display: block; width: 100%; height: 100%; }
    .donut-track { fill: none; stroke: var(--ms-line); stroke-width: 18; opacity: 0.55; }
    .donut-segment { fill: none; stroke-width: 18; stroke-linecap: butt; transition: stroke-dasharray 240ms ease; }

    .donut-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      padding: 30px;
      text-align: center;
    }
    .donut-center span { color: var(--ms-text-muted); font-size: 0.62rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .donut-center strong { font-family: var(--ms-font-display); font-size: 1.05rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .donut-center small { color: var(--ms-text-muted); font-size: 0.62rem; line-height: 1.35; }

    .top-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      flex-wrap: wrap;
      margin: 0;
      color: var(--ms-text-muted);
      font-size: 0.72rem;
      line-height: 1.45;
      text-align: center;
    }
    .top-note strong { color: var(--ms-text); }

    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex: none; }

    .legend { display: flex; flex-direction: column; min-width: 0; }
    .legend-row {
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--ms-line);
    }
    .legend-row:last-child { border-bottom: 0; }
    .legend-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .legend-copy strong { font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .legend-copy small { color: var(--ms-text-muted); font-size: 0.68rem; }
    .legend-value { display: flex; flex-direction: column; gap: 1px; text-align: right; }
    .legend-value strong { font-size: 0.85rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .legend-value small { color: var(--ms-text-muted); font-size: 0.68rem; }

    .map-foot {
      display: flex;
      gap: 8px 18px;
      flex-wrap: wrap;
      padding-top: 12px;
      border-top: 1px solid var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.7rem;
      line-height: 1.45;
    }
    .map-foot strong { color: var(--ms-text); }

    .map-empty {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px;
      border: 1px dashed var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: var(--ms-surface);
    }
    .empty-icon { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--ms-primary-soft); color: var(--ms-primary-strong); }
    .map-empty h3 { margin: 0 0 3px; font-size: 0.9rem; }
    .map-empty p { margin: 0; max-width: 60ch; color: var(--ms-text-muted); font-size: 0.75rem; line-height: 1.45; }
    .map-empty a { flex: none; margin-left: auto; }

    @media (max-width: 760px) {
      .map-card { padding: 18px 16px; gap: 14px; }
      .map-head { flex-direction: column; }
      .ask-link { width: 100%; justify-content: center; }
      .map-body { grid-template-columns: minmax(0, 1fr); gap: 10px; }
      .chart-side { flex-direction: row; justify-content: center; gap: 14px; }
      .top-note { max-width: 16em; text-align: left; justify-content: flex-start; }
      .legend { width: 100%; }
      .map-empty { align-items: flex-start; flex-wrap: wrap; }
      .map-empty a { width: 100%; margin-left: 0; justify-content: center; }
    }

    @media (max-width: 420px) {
      .chart-side { flex-direction: column; }
      .top-note { max-width: none; text-align: center; justify-content: center; }
      .donut-wrap { width: 160px; height: 160px; }
      .donut-center strong { font-size: 0.95rem; }
    }
  `],
})
export class CompensationMapComponent {
  protected readonly vm = inject(CompensationFacade);

  protected readonly mix = computed<EarningSource[]>(() => {
    const me = this.vm.data();
    const scheduledMentor = (me?.mentorBonuses ?? [])
      .filter((bonus) => bonus.status === 'scheduled')
      .reduce((sum, bonus) => sum + Number(bonus.amount ?? 0), 0);
    const rows = [
      { key: 'product', label: 'Product commissions', color: '#667eea', released: this.vm.productReleased(), pending: this.vm.productPending() },
      { key: 'activation', label: 'Activation commissions', color: '#a78bfa', released: this.vm.activationReleased(), pending: this.vm.activationPending() },
      { key: 'mentor', label: 'Mentor bonus', color: '#f59e0b', released: Number(me?.summary.mentorPaid ?? 0), pending: scheduledMentor },
      { key: 'store', label: 'Store & resale', color: '#10b981', released: Number(this.vm.storeEarnings()?.released ?? 0), pending: Number(this.vm.storeEarnings()?.pending ?? 0) },
    ];
    const total = rows.reduce((sum, row) => sum + row.released, 0);
    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? (row.released / total) * 100 : 0,
    }));
  });

  protected readonly releasedTotal = computed(() =>
    this.mix().reduce((sum, item) => sum + item.released, 0));

  protected readonly pendingTotal = computed(() =>
    this.mix().reduce((sum, item) => sum + item.pending, 0));

  protected readonly segments = computed<DonutSegment[]>(() => {
    let offset = 0;
    return this.mix()
      .filter((item) => item.released > 0)
      .map((item) => {
        const segment = {
          ...item,
          dash: `${item.percent} ${100 - item.percent}`,
          offset: String(-offset),
        };
        offset += item.percent;
        return segment;
      });
  });

  protected readonly topStream = computed(() => {
    const rows = this.mix().filter((item) => item.released > 0);
    if (rows.length === 0) return null;
    return rows.reduce((top, item) => (item.released > top.released ? item : top));
  });

  protected chartLabel(): string {
    const parts = this.mix()
      .filter((item) => item.released > 0)
      .map((item) => `${item.label}: ${this.vm.money(item.released)}`);
    return parts.length > 0
      ? `Released earnings by source — ${parts.join(', ')}`
      : 'No released earnings yet';
  }
}
