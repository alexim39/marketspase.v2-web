import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Consistent empty state with an optional projected action button. */
@Component({
  selector: 'async-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="ms-empty">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
      <strong>{{ title() }}</strong>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      @if (reason()) {
        <p class="empty-detail"><strong>Why:</strong> {{ reason() }}</p>
      }
      @if (next()) {
        <p class="empty-detail empty-next"><strong>Next:</strong> {{ next() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly reason = input<string>('');
  readonly next = input<string>('');
}
