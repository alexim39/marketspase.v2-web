import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** The three view classes used by the application chrome and page wrappers. */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type DeviceOrientation = 'portrait' | 'landscape';

/**
 * Single source of truth for the mobile breakpoint.
 *
 * Keep this pure so the boundary is easy to test and the service, tests and
 * any future SSR shell cannot drift apart.
 */
export const deviceTypeForWidth = (width: number): DeviceType => {
  if (!Number.isFinite(width) || width < 600) return 'mobile';
  if (width < 960) return 'tablet';
  return 'desktop';
};

const MOBILE_QUERY = '(max-width: 599.98px)';
const TABLET_QUERY = '(min-width: 600px) and (max-width: 959.98px)';
const DESKTOP_QUERY = '(min-width: 960px)';
const PORTRAIT_QUERY = '(orientation: portrait)';

/**
 * Reactive device classification for the platform and store apps.
 *
 * Mobile and tablet both render the dedicated mobile views. Desktop renders
 * the existing desktop views. The initial value is read synchronously from the
 * viewport so the first paint never flashes the wrong layout.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly typeState = signal<DeviceType>(this.readInitialType());
  private readonly orientationState = signal<DeviceOrientation>(this.readInitialOrientation());

  /** Current device class. */
  readonly type = this.typeState.asReadonly();
  /** Current screen orientation, updated on rotation/resize. */
  readonly orientation = this.orientationState.asReadonly();
  /** True for phones and tablets; the dedicated mobile view should render. */
  readonly isMobileView = computed(() => this.type() !== 'desktop');
  /** True for desktop-class viewports. */
  readonly isDesktop = computed(() => this.type() === 'desktop');
  /** True for phone-class viewports. */
  readonly isHandset = computed(() => this.type() === 'mobile');
  /** True for tablet-class viewports. */
  readonly isTablet = computed(() => this.type() === 'tablet');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.breakpoints
      .observe([MOBILE_QUERY, TABLET_QUERY, DESKTOP_QUERY, PORTRAIT_QUERY])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        const matches = state.breakpoints;
        this.typeState.set(
          matches[MOBILE_QUERY]
            ? 'mobile'
            : matches[TABLET_QUERY]
              ? 'tablet'
              : matches[DESKTOP_QUERY]
                ? 'desktop'
                : deviceTypeForWidth(this.viewportWidth()),
        );
        this.orientationState.set(matches[PORTRAIT_QUERY] ? 'portrait' : 'landscape');
      });
  }

  private readInitialType(): DeviceType {
    if (!isPlatformBrowser(this.platformId)) return 'desktop';
    return deviceTypeForWidth(this.viewportWidth());
  }

  private readInitialOrientation(): DeviceOrientation {
    if (!isPlatformBrowser(this.platformId)) return 'landscape';
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }

  private viewportWidth(): number {
    return typeof window === 'undefined' ? 0 : window.innerWidth;
  }
}
