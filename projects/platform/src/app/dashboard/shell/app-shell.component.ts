import { Component, DestroyRef, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AsyncPipe, CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { filter, map, shareReplay } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { LogoComponent } from '../../_common/logo.component';
import { ProfileComponent } from '../partner/profile/profile.component';
import { NotificationBellComponent } from '../notifications/bell/notification-bell.component';
import { OraWidgetComponent } from '../ora/ora-widget.component';
import { SearchPaletteComponent } from '../search/search-palette.component';
import { PartnerInterface, PartnerService } from '../../_common/services/partner.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeTogglerService } from '../../_common/services/theme-toggler.service';
import { NotificationStreamService } from '../../core/notifications/notification-stream.service';
import { TopProgressService } from '../../core/loading/top-progress.service';
import { ViewAsService } from '../../core/viewas/viewas.service';
import { LeadPipelineService } from '../partner/prospects/lead-pipeline/lead-pipeline.service';
import { NEW_NAV_PRIMARY, NavPrimary } from './nav.config';

/**
 * The single MarketSpase application shell.
 * Desktop: collapsible rail + sticky topbar. Mobile: drawer + bottom nav.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatProgressBarModule,
    MatTooltipModule,
    AsyncPipe,
    LogoComponent,
    ProfileComponent,
    NotificationBellComponent,
    OraWidgetComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AppShellComponent {
  private breakpointObserver = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly nav = NEW_NAV_PRIMARY;
  protected readonly adminUrl = environment.adminUrl;
  protected readonly openKeys = new Set<string>();
  protected readonly collapsed = signal(false);
  protected readonly pageTitle = signal('Home');

  partner!: PartnerInterface;

  protected readonly stream = inject(NotificationStreamService);
  private readonly presence = inject(AuthService);
  protected readonly progress = inject(TopProgressService);
  private readonly themes = inject(ThemeTogglerService);
  private readonly dialog = inject(MatDialog);
  protected readonly viewAs = inject(ViewAsService);
  private readonly pipeline = inject(LeadPipelineService);
  readonly theme = this.themes.theme;

  protected readonly remindersDue = signal<number | null>(null);
  protected readonly unreadMessages = computed(() => this.stream.unreadCount());

  /**
   * Compact/mobile chrome below 768px. CDK's Handset includes landscape
   * tablets up to 960px, which would wrongly collapse the rail there.
   */
  isHandset$: Observable<boolean> = this.breakpointObserver.observe('(max-width: 767.98px)')
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(
    private router: Router,
    private partnerService: PartnerService,
  ) {}

  ngOnInit(): void {
    this.pageTitle.set(this.titleFor(this.router.url));
    this.revealActiveRoute(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.pageTitle.set(this.titleFor(event.urlAfterRedirects));
        this.revealActiveRoute(event.urlAfterRedirects);
      });

    this.partnerService.getPartner().subscribe({
      next: (response) => {
        if (response.success) {
          this.partner = response.data as PartnerInterface;
          this.partnerService.updatePartnerService(this.partner);
        }
      },
      error: () => {
        this.router.navigate(['/']);
      }
    });

    this.startPresenceHeartbeat();
    this.bindSearchShortcut();
    this.refreshRemindersBadge();
  }

  toggleGroup(key: string): void {
    // A collapsed rail has no labels — clicking a section reopens it first.
    if (this.collapsed()) {
      this.collapsed.set(false);
      this.openKeys.clear();
      this.openKeys.add(key);
      return;
    }
    if (this.openKeys.has(key)) {
      this.openKeys.delete(key);
    } else {
      // Keep the rail focused: one expanded section at a time.
      this.openKeys.clear();
      this.openKeys.add(key);
    }
  }

  /**
   * The group name is both the hub link and the accordion toggle:
   * closed → open + go to the hub; open → close and stay on the current page.
   */
  protected onGroupClick(item: NavPrimary): void {
    if (this.collapsed()) {
      this.collapsed.set(false);
      this.openKeys.clear();
      this.openKeys.add(item.key);
      if (item.link) void this.router.navigateByUrl(item.link);
      return;
    }
    if (this.openKeys.has(item.key)) {
      this.openKeys.delete(item.key);
      return;
    }
    this.openKeys.clear();
    this.openKeys.add(item.key);
    if (item.link) void this.router.navigateByUrl(item.link);
  }

  protected isGroupActive(item: NavPrimary): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    if (!item.link) return false;
    if (path === item.link) return true;
    const childActive = (item.children ?? []).some((child) => child.link && path.endsWith(child.link));
    if (childActive) return true;
    if (item.link === '/dashboard') return false;
    return path.startsWith(`${item.link}/`);
  }

  isOpen(key: string): boolean {
    return this.openKeys.has(key);
  }

  protected showSection(index: number): boolean {
    const item = this.nav[index];
    return !!item?.section && (index === 0 || this.nav[index - 1]?.section !== item.section);
  }

  protected sectionLabel(section?: NavPrimary['section']): string {
    switch (section) {
      case 'connect': return 'Connect';
      case 'account': return 'Account';
      default: return 'Workspace';
    }
  }

  toggleCollapse(): void {
    this.collapsed.update((value) => !value);
  }

  openSearch(): void {
    this.dialog.open(SearchPaletteComponent, {
      autoFocus: 'dialog',
      restoreFocus: true,
      panelClass: 'search-palette-panel',
    });
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  signOut(): void {
    localStorage.clear();
    sessionStorage.clear();
    // v1 session sign-out clears the httpOnly cookie + fallback token.
    this.presence.signOut().subscribe({
      next: () => this.router.navigate(['/'], { replaceUrl: true }),
      error: () => this.router.navigate(['/'], { replaceUrl: true }),
    });
    this.scrollToTop();
  }

  onNavigate(drawer: any): void {
    this.scrollToTop();
    if (this.breakpointObserver.isMatched('(max-width: 767.98px)')) {
      try { drawer.close(); } catch { /* drawer may not be open */ }
    }
  }

  protected canSee(permission?: string): boolean {
    return !permission || this.presence.hasPermission(permission);
  }

  protected activationNeeded(): boolean {
    return this.presence.currentUser()?.accountState === 'member';
  }

  protected profileIncomplete(): boolean {
    const p = (this.partner ?? {}) as Partial<PartnerInterface> & {
      phone?: unknown; address?: { street?: unknown; city?: unknown; state?: unknown };
    };
    const filled = (v: unknown): boolean => String(v ?? '').trim().length > 0;
    return !filled(p.phone)
      || !filled(p.address?.street) || !filled(p.address?.city) || !filled(p.address?.state);
  }

  /** Breadcrumb-ish page title derived from the single nav config. */
  private titleFor(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    for (const group of this.nav) {
      if (group.link && path === group.link) return group.label;
      for (const child of group.children ?? []) {
        if (child.link && path.endsWith(child.link.replace('/dashboard', ''))) return child.label;
      }
    }
    // Secondary destinations live on hub cards rather than the rail — use the
    // deepest route title so their topbar still names the page.
    const routeTitle = this.deepestRouteTitle();
    return routeTitle ? routeTitle.split(' - ')[0].trim() : 'Dashboard';
  }

  private deepestRouteTitle(): string | null {
    let route = this.router.routerState.snapshot.root;
    let title: string | null = null;
    while (route.firstChild) {
      route = route.firstChild;
      if (route.title) title = route.title;
    }
    return title ?? route.title ?? null;
  }

  private bindSearchShortcut(): void {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.openSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    this.destroyRef.onDestroy(() => document.removeEventListener('keydown', onKey));
  }

  private refreshRemindersBadge(): void {
    this.pipeline
      .reminders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const d = res.data;
          this.remindersDue.set(d ? d.overdue.length + d.today.length : 0);
        },
        error: () => this.remindersDue.set(null),
      });
  }

  private startPresenceHeartbeat(): void {
    const ping = () => {
      this.presence.ping().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
    };
    ping();
    const timer = setInterval(ping, 4 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** Keep the group holding the active route expanded, and only that group. */
  private revealActiveRoute(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    let activeKey: string | null = null;
    for (const group of this.nav) {
      if (group.link && (path === group.link || (group.link !== '/dashboard' && path.startsWith(`${group.link}/`)))) {
        activeKey = group.key;
        break;
      }
      const hit = (group.children ?? []).some((child) => child.link && path.endsWith(child.link));
      if (hit) {
        activeKey = group.key;
        break;
      }
    }
    if (activeKey) {
      this.openKeys.clear();
      this.openKeys.add(activeKey);
    }
  }
}
