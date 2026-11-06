import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { environment } from '../../../environments/environment';
import { CartService } from '../../store/cart/cart.service';

@Component({
  selector: 'async-site-header',
  imports: [RouterModule, MatIconModule, BrandLogoComponent],
  template: `
    <header class="ms-header">
      <div class="bar ms-store-page">
        <a routerLink="/" class="brand" aria-label="MarketSpase Store home">
          <async-brand-logo class="brand-logo" variant="full-dark" height="30px" alt="" />
          <span class="brand-store" aria-hidden="true">Store</span>
        </a>

        <nav class="desktop-nav" aria-label="Primary navigation">
          <a routerLink="/stores" routerLinkActive="active">Find a store</a>
          <a routerLink="/support" routerLinkActive="active">Support</a>
          <a routerLink="/cart" routerLinkActive="active" class="cart-link">
            <mat-icon aria-hidden="true">shopping_bag</mat-icon>
            <span>Cart</span>
            @if (cart.itemCount() > 0) {
              <span class="cart-count" [attr.aria-label]="cart.itemCount() + ' items in cart'">{{ cart.itemCount() }}</span>
            }
          </a>
          <a [href]="platformUrl + '/partner/signin'">Partner sign in</a>
          <a class="cta" [href]="platformUrl + '/partner/signup'">Become a partner</a>
        </nav>

        <button
          type="button"
          class="menu-btn"
          (click)="menuOpen.set(!menuOpen())"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="store-mobile-nav"
          aria-label="Open navigation menu">
          <mat-icon aria-hidden="true">{{ menuOpen() ? 'close' : 'menu' }}</mat-icon>
        </button>
      </div>

      @if (menuOpen()) {
        <nav id="store-mobile-nav" class="mobile-nav" aria-label="Mobile navigation">
          <a routerLink="/stores" (click)="close()">Find a store</a>
          <a routerLink="/support" (click)="close()">Support</a>
          <a routerLink="/cart" (click)="close()" class="cart-link">
            <mat-icon aria-hidden="true">shopping_bag</mat-icon>
            <span>Cart</span>
            @if (cart.itemCount() > 0) {
              <span class="cart-count">{{ cart.itemCount() }}</span>
            }
          </a>
          <a [href]="platformUrl + '/partner/signin'" (click)="close()">Partner sign in</a>
          <a class="mobile-cta" [href]="platformUrl + '/partner/signup'" (click)="close()">Become a partner</a>
        </nav>
      }
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .ms-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: color-mix(in srgb, var(--ms-surface) 92%, transparent);
      border-bottom: 1px solid var(--ms-line);
      backdrop-filter: blur(18px);
    }

    .bar {
      min-height: 70px;
      display: flex;
      align-items: center;
      gap: 1.5em;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.55em;
      color: var(--ms-text);
      text-decoration: none;
      flex: none;
    }

    .brand-logo {
      display: block;
      width: auto;
      height: 30px;
    }

    .brand-store {
      padding-left: 0.55em;
      border-left: 1px solid var(--ms-line);
      color: var(--ms-text-muted);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      line-height: 1;
      text-transform: uppercase;
    }

    .desktop-nav {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.2em;
      margin-left: auto;
    }

    .desktop-nav a {
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      padding: 0 0.8em;
      border-radius: 12px;
      color: var(--ms-text-muted);
      text-decoration: none;
      font-size: 0.86em;
      font-weight: 650;
    }

    .desktop-nav a:hover,
    .desktop-nav a.active {
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .desktop-nav .cart-link,
    .mobile-nav .cart-link {
      gap: 0.35em;
    }

    .desktop-nav .cart-link mat-icon,
    .mobile-nav .cart-link mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .cart-count {
      display: inline-grid;
      min-width: 19px;
      height: 19px;
      place-items: center;
      padding: 0 0.3em;
      border-radius: 999px;
      background: var(--ms-primary-strong);
      color: #fff;
      font-size: 0.68rem;
      font-weight: 800;
      line-height: 1;
    }

    .desktop-nav .cta {
      margin-left: 0.35em;
      padding: 0 1em;
      background: var(--ms-primary-strong);
      color: #fff;
      font-weight: 750;
    }

    .desktop-nav .cta:hover {
      background: var(--ms-secondary);
      color: #fff;
    }

    .menu-btn {
      display: none;
      margin-left: auto;
      width: 42px;
      height: 42px;
      place-items: center;
      border: 1px solid var(--ms-line);
      border-radius: 12px;
      background: var(--ms-surface);
      color: var(--ms-text);
      cursor: pointer;
    }

    .mobile-nav {
      display: none;
      padding: 0.5em 0.85em 1em;
      border-top: 1px solid var(--ms-line);
      background: var(--ms-surface);
    }

    .mobile-nav a {
      display: flex;
      align-items: center;
      min-height: 46px;
      padding: 0 0.75em;
      border-radius: 10px;
      color: var(--ms-text);
      text-decoration: none;
      font-weight: 650;
    }

    .mobile-nav a:hover {
      background: var(--ms-primary-soft);
      color: var(--ms-primary-strong);
    }

    .mobile-nav .mobile-cta {
      margin-top: 0.3em;
      justify-content: center;
      background: var(--ms-primary-strong);
      color: #fff;
    }

    @media (max-width: 780px) {
      .desktop-nav { display: none; }
      .menu-btn { display: grid; }
      .mobile-nav { display: flex; flex-direction: column; }
    }

    @media (max-width: 600px) {
      .bar { min-height: 62px; }
      .brand-logo { height: 27px; }
    }
  `],
})
export class SiteHeaderComponent {
  protected readonly cart = inject(CartService);
  protected readonly menuOpen = signal(false);
  protected readonly platformUrl = String((environment as { platformUrl?: string }).platformUrl ?? '')
    .replace(/\/+$/, '');

  protected close(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
  }
}
