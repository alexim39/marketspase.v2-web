import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/** Small status pill with text + colour semantics. */
@Component({
  selector: 'async-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'ms-chip ms-chip--' + tone()">{{ label() }}</span>`,
})
export class StatusChipComponent {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
}
