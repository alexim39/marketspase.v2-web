import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Sticky mobile action dock. Project the primary/secondary buttons; the shared
 * mobile stylesheet gives every projected button/link a 44px touch target.
 */
@Component({
  selector: 'async-mobile-sticky-action',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ms-mobile-sticky-action"
      [class.is-above-nav]="aboveBottomNav()"
      role="region"
      [attr.aria-label]="ariaLabel()"
    >
      <ng-content />
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ms-mobile-sticky-action {
      position: sticky;
      bottom: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px var(--ms-mobile-gutter) calc(12px + var(--ms-safe-bottom));
      border-top: 1px solid var(--ms-line);
      background: color-mix(in srgb, var(--ms-surface) 92%, transparent);
      backdrop-filter: saturate(160%) blur(16px);
      box-sizing: border-box;
    }

    .ms-mobile-sticky-action.is-above-nav {
      bottom: calc(var(--ms-mobile-bottom-nav-height) + var(--ms-safe-bottom));
      padding-bottom: 12px;
    }
  `],
})
export class MobileStickyActionComponent {
  readonly ariaLabel = input('Page actions');
  readonly aboveBottomNav = input(false);
}
