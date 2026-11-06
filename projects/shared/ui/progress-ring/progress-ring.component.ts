import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type RingTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'teal';

/** Compact SVG progress ring used for completion, placement and escrow progress. */
@Component({
  selector: 'async-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms-progress-ring" [style.width.px]="size()" [style.height.px]="size()">
      <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" role="img" [attr.aria-label]="label() + ': ' + clamped() + '%'">
        <circle
          class="ring-track"
          [attr.cx]="size() / 2"
          [attr.cy]="size() / 2"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke-width]="stroke()"
        />
        <circle
          [class]="'ring-value tone-' + tone()"
          [attr.cx]="size() / 2"
          [attr.cy]="size() / 2"
          [attr.r]="radius()"
          fill="none"
          [attr.stroke-width]="stroke()"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="offset()"
          [attr.transform]="'rotate(-90 ' + size() / 2 + ' ' + size() / 2 + ')'"
        />
      </svg>
      <span>{{ clamped() }}%</span>
    </div>
  `,
})
export class ProgressRingComponent {
  readonly value = input<number>(0);
  readonly size = input<number>(48);
  readonly stroke = input<number>(5);
  readonly tone = input<RingTone>('brand');
  readonly label = input<string>('Progress');

  protected readonly clamped = computed(() => Math.min(Math.max(Math.round(Number(this.value()) || 0), 0), 100));
  protected readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly offset = computed(() => this.circumference() * (1 - this.clamped() / 100));
}
