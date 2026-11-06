import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ADMIN_NAV } from '../../dashboard/admin/admin-nav.config';

@Component({
  selector: 'async-admin-shell',
  templateUrl: './admin-shell.component.html',
  styleUrls: ['./admin-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterModule, BrandLogoComponent],
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themes = inject(ThemeService);

  protected readonly nav = ADMIN_NAV;
  protected readonly menuOpen = signal(false);
  protected readonly platformUrl = environment.platformUrl;
  protected readonly storeUrl = environment.storeUrl;
  protected readonly user = this.auth.currentUser;
  protected readonly theme = this.themes.theme;

  protected initials(): string {
    const user = this.user();
    return `${user?.name?.[0] ?? ''}${user?.surname?.[0] ?? ''}`.toUpperCase() || 'MS';
  }

  protected close(): void {
    this.menuOpen.set(false);
  }

  protected toggleTheme(): void {
    this.themes.toggle();
  }

  protected signOut(): void {
    this.auth.signOut().subscribe({
      next: () => void this.router.navigate(['/signin'], { replaceUrl: true }),
      error: () => void this.router.navigate(['/signin'], { replaceUrl: true }),
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
  }
}
