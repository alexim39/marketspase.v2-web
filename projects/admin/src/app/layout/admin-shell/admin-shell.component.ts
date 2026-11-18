import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { BrandLogoComponent } from '@marketspase/shared/ui/brand-logo/brand-logo.component';
import { ThemeService } from '@marketspase/shared/core/ui/theme.service';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ADMIN_NAV, AdminNavGroup, AdminNavLeaf } from '../../dashboard/admin/admin-nav.config';

const OPEN_GROUP_KEY = 'ms_admin_nav_open_group';
const FAVORITES_KEY = 'ms_admin_nav_favorites';
const RECENT_KEY = 'ms_admin_nav_recent';
const MAX_RECENT = 5;

const canStore = (): boolean => typeof localStorage !== 'undefined';

const readString = (key: string): string | null => {
  try {
    return canStore() ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const readList = (key: string): string[] => {
  const raw = readString(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value: unknown): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    if (canStore()) localStorage.setItem(key, value);
  } catch {
    // Private mode or a full quota must never break navigation.
  }
};

const removeStorage = (key: string): void => {
  try {
    if (canStore()) localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
};

const pathOf = (url: string): string => url.split(/[?#]/)[0];

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
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('navSearch');

  protected readonly nav = ADMIN_NAV;
  protected readonly menuOpen = signal(false);
  protected readonly query = signal('');
  protected readonly openGroup = signal<string | null>(null);
  protected readonly favorites = signal<string[]>(readList(FAVORITES_KEY));
  protected readonly recent = signal<string[]>(readList(RECENT_KEY));
  protected readonly currentUrl = signal(pathOf(this.router.url));
  protected readonly platformUrl = environment.platformUrl;
  protected readonly storeUrl = environment.storeUrl;
  protected readonly user = this.auth.currentUser;
  protected readonly theme = this.themes.theme;

  private readonly activeGroupKey = computed<string | null>(() => {
    const path = this.currentUrl();
    const group = this.nav.find((candidate) =>
      candidate.children.some((item) => this.isLinkActive(item.link, path)));
    return group?.key ?? null;
  });

  protected readonly filteredGroups = computed<AdminNavGroup[]>(() => {
    const needle = this.query().trim().toLowerCase();
    if (!needle) return this.nav;
    return this.nav
      .map((group) => {
        const groupMatches = group.label.toLowerCase().includes(needle);
        const children = groupMatches
          ? group.children
          : group.children.filter((item) => this.matchesQuery(item, needle));
        return { ...group, children };
      })
      .filter((group) => group.children.length > 0);
  });

  protected readonly favoriteItems = computed(() =>
    this.favorites()
      .map((link) => this.findLeaf(link))
      .filter((item): item is AdminNavLeaf => Boolean(item)));

  protected readonly recentItems = computed(() =>
    this.recent()
      .filter((link) => !this.favorites().includes(link))
      .map((link) => this.findLeaf(link))
      .filter((item): item is AdminNavLeaf => Boolean(item)));

  constructor() {
    const stored = readString(OPEN_GROUP_KEY);
    const initial = this.activeGroupKey()
      ?? (stored && this.nav.some((group) => group.key === stored) ? stored : null);
    this.openGroup.set(initial);
    this.recordVisit(this.currentUrl());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const path = pathOf(event.urlAfterRedirects);
        this.currentUrl.set(path);
        const groupKey = this.activeGroupKey();
        if (groupKey) {
          this.openGroup.set(groupKey);
          writeStorage(OPEN_GROUP_KEY, groupKey);
        }
        this.recordVisit(path);
        this.menuOpen.set(false);
      });
  }

  protected initials(): string {
    const user = this.user();
    return `${user?.name?.[0] ?? ''}${user?.surname?.[0] ?? ''}`.toUpperCase() || 'MS';
  }

  protected close(): void {
    this.menuOpen.set(false);
    this.query.set('');
  }

  protected toggleMenu(): void {
    if (this.menuOpen()) {
      this.close();
      return;
    }
    this.menuOpen.set(true);
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

  protected isActive(link: string): boolean {
    return this.isLinkActive(link, this.currentUrl());
  }

  protected groupHasActive(group: AdminNavGroup): boolean {
    return group.children.some((item) => this.isActive(item.link));
  }

  protected isGroupOpen(group: AdminNavGroup): boolean {
    return this.query().trim().length > 0 || this.openGroup() === group.key;
  }

  protected toggleGroup(group: AdminNavGroup): void {
    if (this.query().trim()) {
      this.query.set('');
      this.openGroup.set(group.key);
      writeStorage(OPEN_GROUP_KEY, group.key);
      return;
    }
    const next = this.openGroup() === group.key ? null : group.key;
    this.openGroup.set(next);
    if (next) writeStorage(OPEN_GROUP_KEY, next);
    else removeStorage(OPEN_GROUP_KEY);
  }

  protected isFavorite(link: string): boolean {
    return this.favorites().includes(link);
  }

  protected toggleFavorite(link: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const current = this.favorites();
    const next = current.includes(link)
      ? current.filter((value) => value !== link)
      : [...current, link];
    this.favorites.set(next);
    writeStorage(FAVORITES_KEY, JSON.stringify(next));
  }

  protected clearSearch(): void {
    this.query.set('');
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.query().trim()) {
      this.clearSearch();
      return;
    }
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    this.menuOpen.set(true);
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
  }

  private isLinkActive(link: string, path: string): boolean {
    if (link === '/dashboard') return path === '/dashboard';
    // One menu destination covers every decision-summary tab.
    if (link === '/summaries/overview') return path === '/summaries' || path.startsWith('/summaries/');
    // Member 360 is opened from the member directory.
    if (link === '/roles') return path === '/roles' || path.startsWith('/members/');
    return path === link || path.startsWith(`${link}/`);
  }

  private matchesQuery(item: AdminNavLeaf, needle: string): boolean {
    return item.label.toLowerCase().includes(needle)
      || item.link.toLowerCase().includes(needle)
      || (item.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(needle));
  }

  private findLeaf(link: string): AdminNavLeaf | undefined {
    for (const group of this.nav) {
      const match = group.children.find((item) => item.link === link);
      if (match) return match;
    }
    return undefined;
  }

  private matchLeaf(path: string): AdminNavLeaf | undefined {
    if (path === '/summaries' || path.startsWith('/summaries/')) {
      return this.findLeaf('/summaries/overview');
    }
    if (path.startsWith('/members/')) return this.findLeaf('/roles');
    for (const group of this.nav) {
      const match = group.children.find((item) => this.isLinkActive(item.link, path));
      if (match) return match;
    }
    return undefined;
  }

  private recordVisit(path: string): void {
    const leaf = this.matchLeaf(path);
    if (!leaf) return;
    const next = [leaf.link, ...this.recent().filter((link) => link !== leaf.link)]
      .slice(0, MAX_RECENT);
    this.recent.set(next);
    writeStorage(RECENT_KEY, JSON.stringify(next));
  }
}
