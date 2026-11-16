import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

/**
 * Native-style mobile page frame.
 *
 * Pages project their content into the body. Optional app-bar actions and a
 * sticky footer are available through `[mobileActions]` and `[mobileFooter]`.
 * The frame owns the safe-area padding and the 44px back target.
 */
@Component({
  selector: 'async-mobile-page-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <header class="ms-mobile-appbar" [class.is-sticky]="sticky()" role="banner">
      @if (showBack()) {
        <button
          type="button"
          class="ms-mobile-icon-btn"
          (click)="goBack()"
          [attr.aria-label]="backLabel()"
        >
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
        </button>
      }

      <div class="ms-mobile-appbar-copy">
        @if (eyebrow()) {
          <span class="ms-mobile-appbar-eyebrow">{{ eyebrow() }}</span>
        }
        <h1>{{ title() }}</h1>
      </div>

      <div class="ms-mobile-appbar-actions">
        <ng-content select="[mobileActions]" />
      </div>
    </header>

    <div class="ms-mobile-page-body">
      <ng-content />
    </div>

    <ng-content select="[mobileFooter]" />
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
      background: var(--ms-canvas);
    }

    .ms-mobile-appbar {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: var(--ms-mobile-appbar-height);
      padding: var(--ms-safe-top) 8px 0;
      border-bottom: 1px solid var(--ms-line);
      background: color-mix(in srgb, var(--ms-surface) 92%, transparent);
      backdrop-filter: saturate(160%) blur(16px);
      color: var(--ms-text);
      box-sizing: border-box;
    }

    .ms-mobile-appbar.is-sticky {
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .ms-mobile-appbar-copy {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      flex: 1;
      padding: 0 4px;
    }

    .ms-mobile-appbar-copy h1 {
      margin: 0;
      overflow: hidden;
      color: var(--ms-text);
      font-family: var(--ms-font-display);
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ms-mobile-appbar-eyebrow {
      overflow: hidden;
      color: var(--ms-text-muted);
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      line-height: 1.3;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .ms-mobile-appbar-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: none;
    }

    .ms-mobile-icon-btn {
      display: inline-grid;
      min-width: var(--ms-touch-target);
      min-height: var(--ms-touch-target);
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: var(--ms-radius-md);
      background: transparent;
      color: var(--ms-text);
      cursor: pointer;
    }

    .ms-mobile-icon-btn:hover,
    .ms-mobile-icon-btn:focus-visible {
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .ms-mobile-page-body {
      padding: 16px var(--ms-mobile-gutter) calc(32px + var(--ms-safe-bottom));
      box-sizing: border-box;
    }
  `],
})
export class MobilePageShellComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly title = input.required<string>();
  readonly eyebrow = input('');
  readonly showBack = input(true);
  readonly backLabel = input('Back');
  readonly backLink = input<string | null>(null);
  readonly fallbackLink = input('/dashboard');
  readonly sticky = input(true);

  readonly back = output<void>();

  protected goBack(): void {
    this.back.emit();

    const link = this.backLink();
    if (link) {
      void this.router.navigateByUrl(link);
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl(this.fallbackLink());
  }
}
