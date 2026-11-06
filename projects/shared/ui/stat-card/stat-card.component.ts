import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type StatTone = 'brand' | 'teal' | 'amber' | 'rose' | 'blue' | 'violet';

/** Reusable KPI card: label + large value, optional icon tile and meta line. */
@Component({
  selector: 'async-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <article class="ms-stat-card">
      <div class="ms-stat-copy">
        <span class="ms-stat-label">{{ label() }}</span>
        <strong class="ms-stat-value">{{ value() ?? 0 }}</strong>
        @if (meta()) {
          <span class="ms-stat-meta">{{ meta() }}</span>
        }
      </div>
      @if (icon()) {
        <span [class]="'ms-stat-icon tone-' + tone()">
          <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
        </span>
      }
    </article>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number | null>(0);
  readonly meta = input<string>('');
  readonly icon = input<string>('');
  readonly tone = input<StatTone>('brand');
}
