import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SummaryDistributionItem, SummaryFormat } from './summary.models';

const PALETTE = ['#667eea', '#2e7d32', '#d9a406', '#c62828', '#0288d1', '#7b1fa2', '#00897b', '#ef6c00'];

@Component({
  selector: 'async-summary-distribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length === 0) {
      <p class="empty">No data for this window.</p>
    } @else if (kind() === 'donut') {
      <div class="donut-layout">
        <div class="donut" [style.background]="gradient()" role="img" [attr.aria-label]="'Distribution chart'">
          <span class="hole">{{ totalLabel() }}</span>
        </div>
        <ul class="legend">
          @for (item of items(); track item.label; let i = $index) {
            <li>
              <i [style.background]="colorFor(item, i)"></i>
              <span>{{ item.label }}</span>
              <strong>{{ formatValue(item.value) }}</strong>
            </li>
          }
        </ul>
      </div>
    } @else {
      <ul class="bars">
        @for (item of items(); track item.label; let i = $index) {
          <li>
            <div class="bar-head"><span>{{ item.label }}</span><strong>{{ formatValue(item.value) }}</strong></div>
            <div class="bar-track">
              <span [style.width.%]="percentOf(item.value)" [style.background]="colorFor(item, i)"></span>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    .empty { margin: 0; padding: 20px 0; color: var(--ms-text-muted); font-size: .82rem; text-align: center; }
    .donut-layout { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
    .donut { width: 132px; height: 132px; border-radius: 50%; display: grid; place-items: center; flex: none; }
    .hole { width: 86px; height: 86px; border-radius: 50%; background: var(--ms-surface); display: grid; place-items: center; color: var(--ms-text); font-weight: 800; font-size: .82rem; text-align: center; padding: 6px; }
    .legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 7px; }
    .legend li { display: flex; align-items: center; gap: 7px; font-size: .78rem; color: var(--ms-text-muted); }
    .legend i { width: 9px; height: 9px; border-radius: 50%; flex: none; }
    .legend span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .legend strong { color: var(--ms-text); font-variant-numeric: tabular-nums; }
    .bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
    .bar-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; font-size: .78rem; }
    .bar-head span { color: var(--ms-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-head strong { font-variant-numeric: tabular-nums; }
    .bar-track { height: 7px; border-radius: 999px; background: var(--ms-canvas); overflow: hidden; }
    .bar-track span { display: block; height: 100%; border-radius: inherit; min-width: 2px; }
  `],
})
export class SummaryDistributionComponent {
  readonly items = input<SummaryDistributionItem[]>([]);
  readonly kind = input<'bar' | 'donut'>('bar');
  readonly format = input<SummaryFormat>('number');

  protected readonly total = computed(() => this.items().reduce((sum, item) => sum + (Number(item.value) || 0), 0));
  private readonly max = computed(() => Math.max(1, ...this.items().map((item) => Number(item.value) || 0)));

  protected colorFor(item: SummaryDistributionItem, index: number): string {
    return item.color || PALETTE[index % PALETTE.length];
  }

  protected percentOf(value: number): number {
    return Math.max(2, ((Number(value) || 0) / this.max()) * 100);
  }

  protected readonly gradient = computed(() => {
    const items = this.items();
    const total = this.total();
    if (total <= 0) return 'conic-gradient(var(--ms-line) 0 100%)';
    let cursor = 0;
    const segments = items.map((item, index) => {
      const start = cursor;
      cursor += ((Number(item.value) || 0) / total) * 100;
      return `${this.colorFor(item, index)} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    return `conic-gradient(${segments.join(', ')})`;
  });

  protected totalLabel(): string {
    return this.formatValue(this.total());
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
