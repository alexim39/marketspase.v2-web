import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SummaryFormat, SummarySeries } from './summary.models';

const PALETTE = ['#667eea', '#2e7d32', '#d9a406', '#c62828', '#0288d1', '#7b1fa2'];

@Component({
  selector: 'async-summary-trend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (labels().length === 0 || series().length === 0) {
      <p class="empty">No data for this window.</p>
    } @else {
      <div class="legend">
        @for (item of series(); track item.name) {
          <span><i [style.background]="colorFor(item, $index)"></i>{{ item.name }}</span>
        }
      </div>
      <svg viewBox="0 0 100 42" class="plot" preserveAspectRatio="none" role="img" [attr.aria-label]="'Trend over time'">
        <line x1="0" y1="36" x2="100" y2="36" class="grid" vector-effect="non-scaling-stroke" />
        <line x1="0" y1="21" x2="100" y2="21" class="grid" vector-effect="non-scaling-stroke" />
        <line x1="0" y1="6" x2="100" y2="6" class="grid" vector-effect="non-scaling-stroke" />
        @for (item of series(); track item.name) {
          <polyline
            [attr.points]="pointsFor(item)"
            [attr.stroke]="colorFor(item, $index)"
            fill="none"
            stroke-width="1.4"
            stroke-linejoin="round"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke" />
          @for (value of item.values; track $index) {
            <circle
              [attr.cx]="xFor($index)"
              [attr.cy]="yFor(value)"
              r=".85"
              [attr.fill]="colorFor(item, $index)"
              vector-effect="non-scaling-stroke">
              <title>{{ labels()[$index] }} · {{ item.name }}: {{ formatValue(value) }}</title>
            </circle>
          }
        }
      </svg>
      <div class="axis">
        @for (label of labels(); track $index) {
          @if (showLabel($index)) {
            <span>{{ label }}</span>
          }
        }
      </div>
    }
  `,
  styles: [`
    .trend { display: flex; flex-direction: column; gap: 7px; }
    .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: .72rem; color: var(--ms-text-muted); }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .plot { width: 100%; height: 150px; overflow: visible; }
    .grid { stroke: var(--ms-line); stroke-width: 1; stroke-dasharray: 2 3; }
    .axis { display: flex; justify-content: space-between; gap: 4px; color: var(--ms-text-muted); font-size: .64rem; }
    .axis span { white-space: nowrap; }
    .empty { margin: 0; padding: 20px 0; color: var(--ms-text-muted); font-size: .82rem; text-align: center; }
  `],
})
export class SummaryTrendComponent {
  readonly labels = input<string[]>([]);
  readonly series = input<SummarySeries[]>([]);
  readonly format = input<SummaryFormat>('number');

  private readonly pointCount = computed(() => Math.max(
    1,
    ...this.series().map((item) => item.values.length),
  ));

  private readonly maxValue = computed(() => Math.max(
    1,
    ...this.series().flatMap((item) => item.values.map((value) => Number(value) || 0)),
  ));

  protected colorFor(series: SummarySeries, index: number): string {
    return series.color || PALETTE[index % PALETTE.length];
  }

  protected xFor(index: number): number {
    const count = this.pointCount();
    return count <= 1 ? 0 : (index / (count - 1)) * 100;
  }

  protected yFor(value: number): number {
    const ratio = Math.max(0, Number(value) || 0) / this.maxValue();
    return 36 - ratio * 30;
  }

  protected pointsFor(series: SummarySeries): string {
    return series.values
      .map((value, index) => `${this.xFor(index).toFixed(2)},${this.yFor(value).toFixed(2)}`)
      .join(' ');
  }

  protected showLabel(index: number): boolean {
    const labels = this.labels();
    if (labels.length <= 8) return true;
    const step = Math.ceil(labels.length / 6);
    return index % step === 0 || index === labels.length - 1;
  }

  protected formatValue(value: number): string {
    const amount = Number(value) || 0;
    const format = this.format();
    if (format === 'currency') {
      return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
    }
    if (format === 'percent') return `${amount.toFixed(1)}%`;
    return amount.toLocaleString('en-NG');
  }
}
