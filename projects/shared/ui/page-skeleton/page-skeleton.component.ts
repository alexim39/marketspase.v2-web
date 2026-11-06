import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type PageSkeletonLayout =
  | 'dashboard'
  | 'wallet'
  | 'list'
  | 'table'
  | 'cards'
  | 'storefront'
  | 'product'
  | 'form'
  | 'checkout'
  | 'profile';

/**
 * Page-aware loading skeleton.
 *
 * Every variant mirrors the real page it stands in for, so the transition from
 * loading to content feels calm instead of jumping from a spinner to a full
 * layout. Uses one shimmer layer per block, disabled by the global
 * prefers-reduced-motion rule.
 */
@Component({
  selector: 'async-page-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms-skel-page" role="status" aria-live="polite" [attr.aria-label]="'Loading ' + label()">
      @if (showHeader()) {
        <div class="ms-skel-head">
          <span class="sk-bar eyebrow"></span>
          <span class="sk-bar title"></span>
          <span class="sk-bar sub"></span>
        </div>
      }

      @switch (layout()) {
        @case ('dashboard') {
          <div class="sk-stat-grid">
            @for (item of four(); track $index) {
              <div class="sk-stat">
                <span class="sk-bar label"></span>
                <span class="sk-bar value"></span>
                <span class="sk-bar meta"></span>
                <span class="sk-tile"></span>
              </div>
            }
          </div>
          <div class="sk-two-col">
            <div class="sk-panel">
              <span class="sk-bar label"></span>
              <span class="sk-bar heading"></span>
              <div class="sk-shortcut-grid">
                @for (item of four(); track $index) { <span class="sk-shortcut"></span> }
              </div>
            </div>
            <div class="sk-panel">
              <span class="sk-bar label"></span>
              <span class="sk-bar heading"></span>
              @for (item of four(); track $index) { <span class="sk-row"></span> }
            </div>
          </div>
        }

        @case ('wallet') {
          <div class="sk-balance">
            <div class="sk-balance-main">
              <span class="sk-bar eyebrow"></span>
              <span class="sk-bar balance"></span>
              <span class="sk-bar note"></span>
            </div>
            <div class="sk-balance-side">
              @for (item of three(); track $index) { <span class="sk-pill-row"></span> }
            </div>
          </div>
          <div class="sk-panel">
            <span class="sk-bar heading"></span>
            <div class="sk-button-row">
              <span class="sk-button"></span><span class="sk-button ghost"></span><span class="sk-button ghost"></span>
            </div>
          </div>
          <div class="sk-flow-grid">
            @for (item of four(); track $index) { <span class="sk-flow"></span> }
          </div>
          <div class="sk-panel">
            <span class="sk-bar heading"></span>
            @for (item of three(); track $index) { <span class="sk-row tall"></span> }
          </div>
        }

        @case ('table') {
          <div class="sk-toolbar">
            <span class="sk-field"></span><span class="sk-field small"></span><span class="sk-field small"></span>
          </div>
          <div class="sk-table">
            <span class="sk-table-head"></span>
            @for (item of rowsRange(); track $index) { <span class="sk-table-row"></span> }
          </div>
        }

        @case ('cards') {
          <div class="sk-toolbar">
            <span class="sk-field"></span><span class="sk-button"></span>
          </div>
          <div class="sk-card-grid">
            @for (item of rowsRange(); track $index) {
              <div class="sk-card">
                <span class="sk-media"></span>
                <span class="sk-bar label"></span>
                <span class="sk-bar line"></span>
                <span class="sk-bar line short"></span>
              </div>
            }
          </div>
        }

        @case ('storefront') {
          <div class="sk-hero">
            <span class="sk-bar eyebrow light"></span>
            <span class="sk-bar hero-title light"></span>
            <span class="sk-bar hero-title short light"></span>
            <span class="sk-bar hero-sub light"></span>
            <div class="sk-button-row">
              <span class="sk-button light"></span><span class="sk-button ghost light"></span>
            </div>
          </div>
          <div class="sk-category-row">
            @for (item of four(); track $index) { <span class="sk-pill"></span> }
          </div>
          <div class="sk-card-grid">
            @for (item of three(); track $index) {
              <div class="sk-card">
                <span class="sk-media tall"></span>
                <span class="sk-bar label"></span>
                <span class="sk-bar line"></span>
                <span class="sk-bar line short"></span>
              </div>
            }
          </div>
        }

        @case ('product') {
          <div class="sk-product">
            <span class="sk-product-media"></span>
            <div class="sk-product-copy">
              <span class="sk-bar eyebrow"></span>
              <span class="sk-bar product-title"></span>
              <span class="sk-bar price"></span>
              <span class="sk-bar line"></span>
              <span class="sk-bar line"></span>
              <span class="sk-bar line short"></span>
              <div class="sk-button-row">
                <span class="sk-button"></span><span class="sk-button ghost"></span>
              </div>
            </div>
          </div>
          <div class="sk-two-col">
            <div class="sk-panel"><span class="sk-bar heading"></span><span class="sk-bar line"></span><span class="sk-bar line short"></span></div>
            <div class="sk-panel"><span class="sk-bar heading"></span><span class="sk-bar line"></span><span class="sk-bar line short"></span></div>
          </div>
        }

        @case ('checkout') {
          <div class="sk-checkout">
            <div class="sk-checkout-main">
              @for (item of three(); track $index) {
                <div class="sk-panel">
                  <span class="sk-bar label"></span>
                  <span class="sk-bar heading"></span>
                  <div class="sk-form-grid">
                    <span class="sk-field"></span><span class="sk-field"></span>
                    <span class="sk-field"></span><span class="sk-field"></span>
                  </div>
                </div>
              }
            </div>
            <div class="sk-panel sk-summary">
              <span class="sk-bar label"></span>
              <span class="sk-bar heading"></span>
              <span class="sk-summary-row"></span>
              <span class="sk-summary-row"></span>
              <span class="sk-summary-row total"></span>
              <span class="sk-button full"></span>
            </div>
          </div>
        }

        @case ('profile') {
          <div class="sk-profile-card">
            <span class="sk-avatar"></span>
            <div class="sk-profile-copy">
              <span class="sk-bar heading"></span>
              <span class="sk-bar line"></span>
              <span class="sk-bar line short"></span>
            </div>
            <span class="sk-button ghost"></span>
          </div>
          <div class="sk-panel">
            <span class="sk-bar heading"></span>
            <div class="sk-form-grid">
              @for (item of four(); track $index) { <span class="sk-field"></span> }
            </div>
          </div>
          @for (item of rowsRange(); track $index) { <span class="sk-accordion"></span> }
        }

        @case ('form') {
          <div class="sk-panel">
            <span class="sk-bar heading"></span>
            <span class="sk-bar line short"></span>
            <div class="sk-form-grid">
              @for (item of rowsRange(); track $index) { <span class="sk-field"></span> }
            </div>
            <span class="sk-button"></span>
          </div>
        }

        @default {
          <div class="sk-panel">
            @for (item of rowsRange(); track $index) {
              <div class="sk-list-row">
                <span class="sk-avatar small"></span>
                <div class="sk-list-copy">
                  <span class="sk-bar line"></span>
                  <span class="sk-bar line short"></span>
                </div>
                <span class="sk-pill"></span>
              </div>
            }
          </div>
        }
      }

      <span class="ms-skel-sr">{{ label() }} is loading</span>
    </div>
  `,
  styles: [`
    .ms-skel-page {
      display: flex;
      flex-direction: column;
      gap: var(--ms-space-5);
      width: 100%;
      padding: 8px 0 40px;
    }

    .ms-skel-head { display: flex; flex-direction: column; gap: 10px; margin-bottom: 2px; }
    .ms-skel-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }

    /* Shared skeleton blocks */
    .sk-bar, .sk-tile, .sk-shortcut, .sk-row, .sk-flow, .sk-field, .sk-button,
    .sk-table-head, .sk-table-row, .sk-media, .sk-hero, .sk-pill, .sk-pill-row,
    .sk-card, .sk-panel, .sk-avatar, .sk-accordion, .sk-summary-row,
    .sk-product-media, .sk-profile-card, .sk-balance, .sk-stat, .sk-product {
      position: relative;
      overflow: hidden;
      background: var(--ms-surface-3);
      border-radius: var(--ms-radius-md);
    }
    .sk-bar::after, .sk-tile::after, .sk-shortcut::after, .sk-row::after, .sk-flow::after,
    .sk-field::after, .sk-button::after, .sk-table-head::after, .sk-table-row::after,
    .sk-media::after, .sk-hero::after, .sk-pill::after, .sk-pill-row::after, .sk-card::after,
    .sk-avatar::after, .sk-accordion::after, .sk-summary-row::after, .sk-product-media::after,
    .sk-product::after, .sk-balance::after, .sk-stat::after, .sk-profile-card::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(100deg, transparent 8%, color-mix(in srgb, var(--ms-primary) 14%, transparent) 45%, transparent 82%);
      animation: sk-shimmer 1.5s ease-in-out infinite;
    }
    @keyframes sk-shimmer { to { transform: translateX(100%); } }

    .sk-bar { height: 12px; }
    .sk-bar.eyebrow { width: 112px; height: 9px; border-radius: 999px; background: var(--ms-primary-soft); }
    .sk-bar.title { width: min(420px, 58%); height: 38px; border-radius: 12px; }
    .sk-bar.sub { width: min(560px, 82%); height: 14px; }
    .sk-bar.label { width: 36%; height: 9px; border-radius: 999px; }
    .sk-bar.heading { width: 42%; height: 20px; border-radius: 8px; }
    .sk-bar.value { width: 54%; height: 32px; border-radius: 9px; }
    .sk-bar.meta { width: 64%; height: 10px; }
    .sk-bar.line { width: 92%; height: 12px; }
    .sk-bar.line.short { width: 58%; }
    .sk-bar.note { width: 80%; height: 11px; }
    .sk-bar.balance { width: 52%; height: 44px; }
    .sk-bar.hero-title { width: 70%; height: 52px; }
    .sk-bar.hero-sub { width: 55%; height: 16px; }
    .sk-bar.product-title { width: 82%; height: 40px; }
    .sk-bar.price { width: 36%; height: 30px; }
    .sk-bar.light { background: rgba(255, 255, 255, 0.22); }

    .sk-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .sk-stat { min-height: 108px; padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; border-radius: var(--ms-radius-lg); background: var(--ms-surface); border: 1px solid var(--ms-line); }
    .sk-tile { position: absolute; right: 18px; top: 18px; width: 48px; height: 48px; border-radius: 14px; }
    .sk-two-col { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: 14px; }
    .sk-panel { padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; border-radius: var(--ms-radius-lg); background: var(--ms-surface); border: 1px solid var(--ms-line); }
    .sk-shortcut-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .sk-shortcut { height: 58px; border-radius: 12px; }
    .sk-row { height: 46px; border-radius: 10px; }
    .sk-row.tall { height: 62px; }

    .sk-balance { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 1fr); gap: 20px; padding: 22px 24px; border-radius: var(--ms-radius-xl); background: var(--ms-primary-soft); }
    .sk-balance-main, .sk-balance-side { display: flex; flex-direction: column; gap: 10px; }
    .sk-pill-row { height: 44px; border-radius: 10px; background: var(--ms-surface); opacity: 0.7; }
    .sk-flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .sk-flow { height: 92px; border-radius: var(--ms-radius-md); background: var(--ms-surface); border: 1px solid var(--ms-line); }
    .sk-button-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .sk-button { width: 128px; height: 42px; border-radius: 12px; background: var(--ms-primary-soft); }
    .sk-button.ghost { background: var(--ms-surface-3); }
    .sk-button.full { width: 100%; }
    .sk-button.light { background: rgba(255, 255, 255, 0.22); }

    .sk-toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
    .sk-field { flex: 1 1 220px; height: 54px; border-radius: 12px; background: var(--ms-surface); border: 1px solid var(--ms-line); }
    .sk-field.small { flex: 0 1 180px; }
    .sk-table { padding: 14px; display: flex; flex-direction: column; gap: 8px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .sk-table-head { height: 34px; background: var(--ms-canvas); }
    .sk-table-row { height: 54px; }
    .sk-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 14px; }
    .sk-card { background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); padding: 12px; display: flex; flex-direction: column; gap: 9px; }
    .sk-media { height: 150px; border-radius: 14px; }
    .sk-media.tall { height: 190px; }

    .sk-hero { min-height: 300px; padding: clamp(28px, 5vw, 56px); display: flex; flex-direction: column; justify-content: center; gap: 14px; border-radius: var(--ms-radius-xl); background: var(--ms-ink); }
    .sk-category-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .sk-pill { width: 108px; height: 34px; border-radius: 999px; }

    .sk-product { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 0.9fr); gap: 24px; padding: 20px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-xl); }
    .sk-product-media { min-height: 360px; border-radius: var(--ms-radius-lg); }
    .sk-product-copy { display: flex; flex-direction: column; gap: 12px; justify-content: center; }
    .sk-checkout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: 18px; align-items: start; }
    .sk-checkout-main { display: flex; flex-direction: column; gap: 14px; }
    .sk-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .sk-summary { gap: 12px; }
    .sk-summary-row { height: 34px; background: var(--ms-surface-3); }
    .sk-summary-row.total { height: 44px; background: var(--ms-primary-soft); }
    .sk-profile-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--ms-surface); border: 1px solid var(--ms-line); border-radius: var(--ms-radius-lg); }
    .sk-profile-copy { flex: 1; display: flex; flex-direction: column; gap: 9px; }
    .sk-avatar { width: 64px; height: 64px; border-radius: 50%; flex: none; }
    .sk-avatar.small { width: 42px; height: 42px; }
    .sk-accordion { height: 58px; border-radius: 12px; background: var(--ms-surface); border: 1px solid var(--ms-line); }
    .sk-list-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
    .sk-list-copy { flex: 1; display: flex; flex-direction: column; gap: 7px; }
    .sk-list-copy .sk-bar { height: 10px; }

    @media (max-width: 960px) {
      .sk-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sk-two-col, .sk-checkout, .sk-product, .sk-balance { grid-template-columns: 1fr; }
      .sk-product-media { min-height: 240px; }
    }
    @media (max-width: 560px) {
      .sk-stat-grid, .sk-form-grid, .sk-shortcut-grid { grid-template-columns: 1fr; }
      .sk-bar.title { width: 82%; height: 32px; }
      .sk-hero { min-height: 240px; }
    }
  `],
})
export class PageSkeletonComponent {
  readonly layout = input<PageSkeletonLayout>('list');
  readonly rows = input<number>(4);
  readonly label = input<string>('page');
  readonly showHeader = input<boolean>(true);

  protected readonly three = computed(() => Array.from({ length: 3 }, (_, i) => i));
  protected readonly four = computed(() => Array.from({ length: 4 }, (_, i) => i));
  protected readonly rowsRange = computed(() => Array.from({ length: Math.max(1, Number(this.rows()) || 4) }, (_, i) => i));
}
