import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Mobile surface for grouped content. Uses the same radius, border and shadow
 * tokens as the desktop cards so the brand stays consistent without importing
 * desktop-only layout classes.
 */
@Component({
  selector: 'async-mobile-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="ms-mobile-card"
      [class.is-flush]="flush()"
      [class.is-interactive]="interactive()"
    >
      <ng-content />
    </section>
  `,
  styles: [`
    :host { display: block; }

    .ms-mobile-card {
      padding: 16px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-xl);
      background: var(--ms-surface);
      box-shadow: var(--ms-shadow-sm);
      box-sizing: border-box;
    }

    .ms-mobile-card.is-flush {
      padding: 0;
      overflow: hidden;
    }

    .ms-mobile-card.is-interactive {
      transition: border-color var(--ms-duration) var(--ms-ease),
        box-shadow var(--ms-duration) var(--ms-ease);
    }

    .ms-mobile-card.is-interactive:hover,
    .ms-mobile-card.is-interactive:focus-within {
      border-color: color-mix(in srgb, var(--ms-primary) 38%, var(--ms-line));
      box-shadow: var(--ms-shadow-md);
    }
  `],
})
export class MobileCardComponent {
  readonly flush = input(false);
  readonly interactive = input(false);
}
