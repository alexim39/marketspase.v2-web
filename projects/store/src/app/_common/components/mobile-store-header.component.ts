import { A11yModule } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { environment } from '../../../environments/environment';
import { CartService } from '../../store/cart/cart.service';

/**
 * Native store header for phones and tablets. The desktop header/site nav is
 * untouched; this keeps the cart, menu and partner CTA within thumb reach.
 */
@Component({
  selector: 'async-mobile-store-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, BrandLogoComponent, MatIconModule, RouterModule],
  template: `
    <header class="ms-mobile-store-header">
      <div class="bar">
        <a routerLink="/" class="brand" (click)="closeMenu()" aria-label="MarketSpase Store home">
          <async-brand-logo
            [variant]="theme() === 'light' ? 'full-dark' : 'full-white'"
            height="27px"
            alt=""
          />
          <span aria-hidden="true">Store</span>
        </a>

        <a
          routerLink="/cart"
          class="icon-btn cart-link"
          [attr.aria-label]="cart.itemCount() ? 'Cart, ' + cart.itemCount() + ' items' : 'Cart'"
          (click)="closeMenu()"
        >
          <mat-icon aria-hidden="true">shopping_bag</mat-icon>
          @if (cart.itemCount() > 0) {
            <span class="cart-count">{{ cart.itemCount() }}</span>
          }
        </a>

        <button
          type="button"
          class="icon-btn"
          (click)="toggleMenu()"
          [attr.aria-expanded]="open()"
          aria-controls="mobile-store-nav-sheet"
          [attr.aria-label]="open() ? 'Close navigation menu' : 'Open navigation menu'"
        >
          <mat-icon aria-hidden="true">{{ open() ? 'close' : 'menu' }}</mat-icon>
        </button>
      </div>
    </header>

    @if (open()) {
      <button
        type="button"
        class="scrim"
        aria-label="Close navigation menu"
        (click)="closeMenu()"
      ></button>

      <nav
        id="mobile-store-nav-sheet"
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Store navigation"
        cdkTrapFocus
      >
        <div class="sheet-head">
          <span>Menu</span>
          <button
            type="button"
            class="sheet-close"
            cdkFocusInitial
            (click)="closeMenu()"
            aria-label="Close menu"
          >
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        </div>

        <a routerLink="/stores" routerLinkActive="active" (click)="closeAndScroll()">
          <mat-icon aria-hidden="true">storefront</mat-icon> Find a store
        </a>
        <a routerLink="/support" routerLinkActive="active" (click)="closeAndScroll()">
          <mat-icon aria-hidden="true">support_agent</mat-icon> Support
        </a>
        <a routerLink="/cart" routerLinkActive="active" (click)="closeAndScroll()">
          <mat-icon aria-hidden="true">shopping_bag</mat-icon> Cart
          @if (cart.itemCount() > 0) {
            <span class="cart-count">{{ cart.itemCount() }}</span>
          }
        </a>
        <a [href]="platformUrl + '/partner/signin'" (click)="closeMenu()">
          <mat-icon aria-hidden="true">login</mat-icon> Partner sign in
        </a>
        <a class="cta" [href]="platformUrl + '/partner/signup'" (click)="closeMenu()">
          Become a partner
        </a>

        <button type="button" class="theme-btn" (click)="toggleTheme()">
          <mat-icon aria-hidden="true">{{ theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
          {{ theme() === 'dark' ? 'Light mode' : 'Dark mode' }}
        </button>
      </nav>
    }
  `,
  styles: [`
    :host { display: block; }

    .ms-mobile-store-header {
      position: sticky;
      top: 0;
      z-index: 100;
      padding-top: var(--ms-safe-top);
      border-bottom: 1px solid var(--ms-line);
      background: color-mix(in srgb, var(--ms-surface) 92%, transparent);
      backdrop-filter: saturate(160%) blur(16px);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 62px;
      padding: 0 var(--ms-mobile-gutter);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-right: auto;
      color: var(--ms-text);
      text-decoration: none;
    }

    .brand span {
      padding-left: 6px;
      border-left: 1px solid var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .icon-btn {
      position: relative;
      display: inline-grid;
      width: var(--ms-touch-target);
      height: var(--ms-touch-target);
      place-items: center;
      padding: 0;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-md);
      background: var(--ms-surface);
      color: var(--ms-text);
      cursor: pointer;
      text-decoration: none;
    }

    .cart-count {
      position: absolute;
      top: 2px;
      right: 2px;
      display: inline-grid;
      min-width: 18px;
      height: 18px;
      place-items: center;
      padding: 0 4px;
      border-radius: var(--ms-radius-pill);
      background: var(--ms-primary-strong);
      color: #fff;
      font-size: 0.62rem;
      font-weight: 800;
      line-height: 1;
    }

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 190;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: rgba(9, 9, 11, 0.48);
      cursor: pointer;
    }

    .sheet {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: min(86svh, 640px);
      padding: 8px var(--ms-mobile-gutter) calc(16px + var(--ms-safe-bottom));
      overflow-y: auto;
      border-radius: var(--ms-radius-2xl) var(--ms-radius-2xl) 0 0;
      background: var(--ms-surface);
      box-shadow: var(--ms-shadow-lg);
      box-sizing: border-box;
    }

    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 2px 0 8px;
      color: var(--ms-text-muted);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .sheet-close {
      display: inline-grid;
      width: var(--ms-touch-target);
      height: var(--ms-touch-target);
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: var(--ms-radius-md);
      background: transparent;
      color: var(--ms-text);
      cursor: pointer;
    }

    .sheet a {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 0 12px;
      border-radius: var(--ms-radius-lg);
      color: var(--ms-text);
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
    }

    .sheet a:hover,
    .sheet a.active {
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .sheet a .cart-count {
      position: static;
      margin-left: auto;
    }

    .sheet a.cta {
      justify-content: center;
      margin-top: 6px;
      background: var(--ms-primary-strong);
      color: #fff;
    }

    .sheet a.cta:hover {
      background: var(--ms-secondary);
      color: #fff;
    }

    .theme-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      margin-top: 6px;
      padding: 0 12px;
      border: 1px solid var(--ms-line);
      border-radius: var(--ms-radius-lg);
      background: var(--ms-surface-2);
      color: var(--ms-text);
      font: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
  `],
})
export class MobileStoreHeaderComponent implements OnDestroy {
  protected readonly cart = inject(CartService);
  private readonly themes = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  protected readonly theme = this.themes.theme;
  protected readonly open = signal(false);
  protected readonly platformUrl = String((environment as { platformUrl?: string }).platformUrl ?? '')
    .replace(/\/+$/, '');

  protected toggleMenu(): void {
    this.open.update((value) => !value);
    this.syncBodyLock();
  }

  protected closeMenu(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.syncBodyLock();
  }

  protected closeAndScroll(): void {
    this.closeMenu();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected toggleTheme(): void {
    this.themes.toggle();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeMenu();
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('ms-sheet-open');
  }

  private syncBodyLock(): void {
    this.document.body.classList.toggle('ms-sheet-open', this.open());
  }
}
