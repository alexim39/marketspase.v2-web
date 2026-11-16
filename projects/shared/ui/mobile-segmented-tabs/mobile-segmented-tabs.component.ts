import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface MobileTab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

/** Horizontally scrollable, tap-first tab strip for mobile pages. */
@Component({
  selector: 'async-mobile-segmented-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="ms-mobile-tabs ms-mobile-scroll" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="ms-mobile-tab"
          [class.is-active]="tab.id === active()"
          [attr.aria-selected]="tab.id === active()"
          (click)="select(tab.id)"
        >
          @if (tab.icon) {
            <mat-icon aria-hidden="true">{{ tab.icon }}</mat-icon>
          }
          <span>{{ tab.label }}</span>
          @if (tab.badge) {
            <span class="ms-mobile-tab-badge">{{ tab.badge }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .ms-mobile-tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 2px 0;
      scroll-snap-type: x proximity;
    }

    .ms-mobile-tab {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: var(--ms-touch-target);
      padding: 0 14px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-pill);
      background: var(--ms-surface);
      color: var(--ms-text-muted);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 650;
      white-space: nowrap;
      cursor: pointer;
      scroll-snap-align: start;
    }

    .ms-mobile-tab.is-active {
      border-color: color-mix(in srgb, var(--ms-primary) 42%, var(--ms-line));
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .ms-mobile-tab mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .ms-mobile-tab-badge {
      display: inline-grid;
      min-width: 18px;
      height: 18px;
      place-items: center;
      padding: 0 5px;
      border-radius: var(--ms-radius-pill);
      background: var(--ms-primary-strong);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 800;
    }
  `],
})
export class MobileSegmentedTabsComponent {
  readonly tabs = input.required<MobileTab[]>();
  readonly active = input.required<string>();
  readonly ariaLabel = input('Sections');
  readonly activeChange = output<string>();

  protected select(id: string): void {
    if (id !== this.active()) this.activeChange.emit(id);
  }
}
