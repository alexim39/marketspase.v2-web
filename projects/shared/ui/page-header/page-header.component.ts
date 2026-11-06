import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Standard page header: eyebrow, title, subtitle and projected actions. */
@Component({
  selector: 'async-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ms-page-head">
      <div>
        @if (eyebrow()) {
          <p class="ms-eyebrow">{{ eyebrow() }}</p>
        }
        <h1 class="ms-page-title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="ms-subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="ms-head-actions">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly eyebrow = input<string>('');
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
