import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';

@Component({
  selector: 'async-nav',
  imports: [MatButtonModule, MatIconModule, RouterModule, BrandLogoComponent],
  template: `
    <header class="site-nav">
      <div class="nav-inner">
        <a class="logo" routerLink="/" (click)="scrollToTop()" aria-label="MarketSpase home">
          <async-brand-logo
            [variant]="theme() === 'light' ? 'full-dark' : 'full-white'"
            height="30px"
            alt=""
          />
        </a>

        <nav class="nav-links" aria-label="Primary navigation">
          <a mat-button routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="scrollToTop()">Home</a>
          <a mat-button routerLink="/how-it-works" routerLinkActive="active" (click)="scrollToTop()">How it works</a>
          <a mat-button routerLink="/ora" routerLinkActive="active" (click)="scrollToTop()">Ora</a>
          <a mat-button routerLink="/about" routerLinkActive="active" (click)="scrollToTop()">About</a>
          <a mat-button routerLink="/faq" routerLinkActive="active" (click)="scrollToTop()">FAQ</a>
          <a mat-flat-button color="primary" routerLink="/partner/signin" routerLinkActive="active" (click)="scrollToTop()">Sign in</a>
          <a mat-button routerLink="/partner/signup" routerLinkActive="active" (click)="scrollToTop()">Start your business</a>
          <button
            class="theme-toggle"
            type="button"
            (click)="toggleTheme()"
            [attr.aria-label]="theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <mat-icon aria-hidden="true">{{ theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
        </nav>

        <div class="nav-mobile-actions">
          <button
            class="theme-toggle"
            type="button"
            (click)="toggleTheme()"
            [attr.aria-label]="theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <mat-icon aria-hidden="true">{{ theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <button
            class="menu-toggle"
            type="button"
            (click)="menuOpen.set(!menuOpen())"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="platform-mobile-nav"
            [attr.aria-label]="menuOpen() ? 'Close navigation menu' : 'Open navigation menu'"
          >
            <mat-icon aria-hidden="true">{{ menuOpen() ? 'close' : 'menu' }}</mat-icon>
          </button>
        </div>
      </div>

      @if (menuOpen()) {
        <nav id="platform-mobile-nav" class="mobile-nav" aria-label="Mobile navigation">
          <a class="mobile-cta" routerLink="/partner/signin" routerLinkActive="active" (click)="closeAndScroll()" aria-label="Sign in to your MarketSpase account">
            <mat-icon aria-hidden="true">login</mat-icon> Sign in
          </a>
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeAndScroll()">Home</a>
          <a routerLink="/how-it-works" routerLinkActive="active" (click)="closeAndScroll()">How it works</a>
          <a routerLink="/ora" routerLinkActive="active" (click)="closeAndScroll()">Meet Ora</a>
          <a routerLink="/about" routerLinkActive="active" (click)="closeAndScroll()">About</a>
          <a routerLink="/faq" routerLinkActive="active" (click)="closeAndScroll()">FAQ</a>
          <a routerLink="/partner/signup" routerLinkActive="active" (click)="closeAndScroll()">Start your business</a>
        </nav>
      }
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .site-nav {
      position: sticky;
      top: 0;
      z-index: 40;
      background: color-mix(in srgb, var(--ms-surface) 92%, transparent);
      border-bottom: 1px solid var(--ms-line);
      backdrop-filter: blur(18px) saturate(160%);
    }

    .nav-inner {
      width: min(1180px, calc(100% - 2.5em));
      min-height: 68px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 1em;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      flex: none;
      text-decoration: none;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.25em;
      margin-left: auto;
    }

    .nav-links a[mat-button] {
      color: var(--ms-text-muted);
      font-weight: 600;
    }

    .nav-links a[mat-button]:hover,
    .nav-links a[mat-button].active {
      color: var(--ms-primary-strong);
    }

    .nav-links a[mat-flat-button] {
      margin-left: 0.35em;
    }

    .theme-toggle,
    .menu-toggle {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 1px solid var(--ms-line);
      border-radius: 12px;
      background: var(--ms-surface);
      color: var(--ms-text-muted);
      cursor: pointer;
    }

    .theme-toggle:hover,
    .menu-toggle:hover {
      color: var(--ms-primary-strong);
      border-color: var(--ms-primary);
    }

    .theme-toggle mat-icon,
    .menu-toggle mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .nav-mobile-actions {
      display: none;
      align-items: center;
      gap: 0.4em;
      margin-left: auto;
    }

    .mobile-nav {
      display: none;
    }

    @media (max-width: 1024px) {
      .nav-inner {
        min-height: 62px;
        width: calc(100% - 1.5em);
      }

      .nav-links { display: none; }

      .nav-mobile-actions { display: flex; }

      .mobile-nav {
        display: flex;
        flex-direction: column;
        gap: 0.25em;
        padding: 0.5em 0.75em 1em;
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
        font-weight: 600;
        text-decoration: none;
      }

      .mobile-nav a:hover,
      .mobile-nav a.active {
        background: var(--ms-primary-soft);
        color: var(--ms-primary-strong);
      }

      .mobile-nav .mobile-cta {
        justify-content: center;
        gap: 0.45em;
        margin-bottom: 0.35em;
        background: var(--ms-primary-strong);
        color: #fff;
      }
    }
  `],
})
export class NavComponent {
  private readonly themes = inject(ThemeService);

  protected readonly theme = this.themes.theme;
  protected readonly menuOpen = signal(false);

  protected toggleTheme(): void {
    this.themes.toggle();
  }

  protected closeAndScroll(): void {
    this.menuOpen.set(false);
    this.scrollToTop();
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
  }
}
