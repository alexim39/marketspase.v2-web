import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BrandLogoVariant = 'full-white' | 'full-dark' | 'mark' | 'mark-badge';

/**
 * Single source of truth for the MarketSpase brand mark.
 *
 * The actual brand files live in projects/shared/assets/brand and are copied
 * into every app under /logo by the workspace asset configuration.
 */
@Component({
  selector: 'async-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'mark-badge') {
      <span class="badge" aria-hidden="true">
        <img src="/logo/marketspase-mark-white.png" alt="" width="1024" height="1024">
      </span>
    } @else {
      <img [src]="src()" [alt]="alt()" [style.height]="height()" width="1200" height="337">
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    img { display: block; width: auto; object-fit: contain; }
    .badge {
      display: inline-grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      box-shadow: 0 6px 18px rgba(102, 126, 234, 0.32);
    }
    .badge img {
      width: 58%;
      height: 58%;
    }
  `],
})
export class BrandLogoComponent {
  readonly variant = input<BrandLogoVariant>('full-white');
  readonly height = input('30px');
  readonly alt = input('MarketSpase');

  protected readonly src = computed(() => {
    switch (this.variant()) {
      case 'full-dark':
        return '/logo/marketspase-logo-dark.png';
      case 'mark':
      case 'mark-badge':
        return '/logo/marketspase-mark-white.png';
      default:
        return '/logo/marketspase-logo-white.png';
    }
  });
}
